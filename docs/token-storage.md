# Token Storage Guide

## Design Philosophy

The SSO SDK follows a **stateless design** similar to Go's `http.Client`:

- **Create once**: Initialize `SSOClient` at application startup
- **Reuse everywhere**: The same instance handles all users safely
- **Pass tokens as parameters**: No state stored in the client
- **You control storage**: Choose any storage backend (Redis, PostgreSQL, sessions, etc.)

This design allows you to implement the persistence strategy that best fits your architecture without being locked into a specific implementation.

---

## Token Lifecycle

### 1. **Login** - Acquire Tokens

```typescript
const tokens = await ssoClient.login(email, password, deviceContext);

// Store tokens in your chosen storage
req.session.tokens = tokens;
// or
await redis.set(`user:${userId}:tokens`, JSON.stringify(tokens));
// or
await db.sessions.create({ userId, tokens });
```

### 2. **Use** - Pass Tokens as Parameters

```typescript
// Option A: Simple call (you handle refresh manually)
const user = await ssoClient.getProfile(tokens.accessToken, deviceContext);

// Option B: Auto-refresh (SDK handles refresh for you)
const { data: user, tokens: newTokens } = await ssoClient.getProfileWithRefresh(
  tokens,
  deviceContext
);
```

### 3. **Refresh** - Auto or Manual

**Automatic (recommended)**:

```typescript
// SDK automatically refreshes if expired
const { data: user, tokens: refreshedTokens } = await ssoClient.getProfileWithRefresh(
  req.session.tokens,
  deviceContext
);

// IMPORTANT: Always save returned tokens
req.session.tokens = refreshedTokens;
```

**Manual**:

```typescript
// Check expiration yourself
if (ssoClient.isTokenExpired(tokens.expiresAt)) {
  tokens = await ssoClient.refreshTokens(tokens.refreshToken, deviceContext);
  req.session.tokens = tokens; // Save new tokens
}

// Then use the fresh token
const user = await ssoClient.getProfile(tokens.accessToken, deviceContext);
```

### 4. **Logout** - Clear Tokens

```typescript
await ssoClient.logout(tokens.accessToken, deviceContext);

// Clear from your storage
delete req.session.tokens;
// or
await redis.del(`user:${userId}:tokens`);
// or
await db.sessions.delete({ userId });
```

---

## Storage Patterns

### Pattern 1: Session Storage (Recommended for Traditional Web Apps)

**Best for**: Express, Fastify, Hono, NestJS with server-side sessions

```typescript
import express from 'express';
import session from 'express-session';
import { SSOClient, Platform } from 'sso-sdk-ts';

// Create client ONCE at startup
const ssoClient = new SSOClient({
  baseUrl: process.env.SSO_URL,
  clientId: process.env.CLIENT_ID,
  publicUrls: {
    emailVerification: process.env.VERIFICATION_URL,
    passwordReset: process.env.RESET_URL,
  },
});

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // Security: prevents XSS
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Login endpoint
app.post('/auth/login', async (req, res) => {
  const deviceContext = {
    platform: Platform.WEB,
    clientIP: req.ip,
    userAgent: req.headers['user-agent'],
  };

  const tokens = await ssoClient.login(req.body.email, req.body.password, deviceContext);

  // Store in session
  req.session.tokens = tokens;

  res.json({ success: true });
});

// Protected endpoint with auto-refresh
app.get('/api/profile', async (req, res) => {
  if (!req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const deviceContext = {
    platform: Platform.WEB,
    clientIP: req.ip,
    userAgent: req.headers['user-agent'],
  };

  // Auto-refresh if needed
  const { data: user, tokens } = await ssoClient.getProfileWithRefresh(
    req.session.tokens,
    deviceContext
  );

  // Save potentially refreshed tokens
  req.session.tokens = tokens;

  res.json(user);
});

// Logout endpoint
app.post('/auth/logout', async (req, res) => {
  if (req.session.tokens) {
    const deviceContext = {
      platform: Platform.WEB,
      clientIP: req.ip,
      userAgent: req.headers['user-agent'],
    };

    await ssoClient.logout(req.session.tokens.accessToken, deviceContext);
    delete req.session.tokens;
  }

  res.json({ success: true });
});
```

**Pros**:
- ✅ Secure (tokens not exposed to client-side JS)
- ✅ Easy to implement
- ✅ Works with existing session middleware

**Cons**:
- ⚠️ Not ideal for serverless (requires sticky sessions or shared session store)

---

### Pattern 2: Redis Storage

**Best for**: Microservices, distributed systems, serverless with Redis

```typescript
import Redis from 'ioredis';
import { SSOClient } from 'sso-sdk-ts';

const redis = new Redis();
const ssoClient = new SSOClient(config); // Created once

// Helper to get tokens from Redis
async function getTokens(userId: string) {
  const data = await redis.get(`user:${userId}:tokens`);
  return data ? JSON.parse(data) : null;
}

// Helper to save tokens to Redis
async function saveTokens(userId: string, tokens: TokenData) {
  await redis.setex(
    `user:${userId}:tokens`,
    24 * 60 * 60, // TTL: 24 hours
    JSON.stringify(tokens)
  );
}

// Login
app.post('/auth/login', async (req, res) => {
  const tokens = await ssoClient.login(req.body.email, req.body.password, deviceContext);

  const userId = req.body.userId; // From your auth system
  await saveTokens(userId, tokens);

  res.json({ success: true });
});

// Protected endpoint
app.get('/api/profile', async (req, res) => {
  const userId = req.user.id; // From your auth middleware

  const tokens = await getTokens(userId);
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { data: user, tokens: newTokens } = await ssoClient.getProfileWithRefresh(
    tokens,
    deviceContext
  );

  // Save refreshed tokens
  await saveTokens(userId, newTokens);

  res.json(user);
});
```

**Pros**:
- ✅ Scales horizontally
- ✅ Works with serverless
- ✅ Fast access
- ✅ Automatic TTL

**Cons**:
- ⚠️ Requires Redis infrastructure

---

### Pattern 3: Database Storage

**Best for**: Traditional monoliths, when you need strong consistency

```typescript
import { SSOClient } from 'sso-sdk-ts';
import { db } from './database'; // Your DB client

const ssoClient = new SSOClient(config);

// Database schema
/*
CREATE TABLE user_sessions (
  user_id UUID PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
*/

// Login
app.post('/auth/login', async (req, res) => {
  const tokens = await ssoClient.login(req.body.email, req.body.password, deviceContext);

  await db.query(
    `INSERT INTO user_sessions (user_id, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
       SET access_token = $2, refresh_token = $3, expires_at = $4, updated_at = NOW()`,
    [userId, tokens.accessToken, tokens.refreshToken, tokens.expiresAt]
  );

  res.json({ success: true });
});

// Protected endpoint
app.get('/api/profile', async (req, res) => {
  const userId = req.user.id;

  const result = await db.query('SELECT * FROM user_sessions WHERE user_id = $1', [userId]);

  if (!result.rows[0]) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const tokens = {
    accessToken: result.rows[0].access_token,
    refreshToken: result.rows[0].refresh_token,
    expiresAt: result.rows[0].expires_at,
  };

  const { data: user, tokens: newTokens } = await ssoClient.getProfileWithRefresh(
    tokens,
    deviceContext
  );

  // Update tokens if refreshed
  await db.query(
    `UPDATE user_sessions
     SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
     WHERE user_id = $4`,
    [newTokens.accessToken, newTokens.refreshToken, newTokens.expiresAt, userId]
  );

  res.json(user);
});
```

**Pros**:
- ✅ Strong consistency
- ✅ No additional infrastructure
- ✅ Easy to query/audit sessions

**Cons**:
- ⚠️ Slower than Redis
- ⚠️ DB writes on every refresh

---

### Pattern 4: Serverless KV Storage

**Best for**: AWS Lambda, Vercel, Cloudflare Workers

**AWS DynamoDB Example**:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SSOClient } from 'sso-sdk-ts';

const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssoClient = new SSOClient(config);

export const handler = async (event) => {
  const userId = event.requestContext.authorizer.userId;

  // Get tokens from DynamoDB
  const { Item } = await dynamoDB.send(
    new GetCommand({
      TableName: 'UserSessions',
      Key: { userId },
    })
  );

  if (!Item) {
    return { statusCode: 401, body: 'Not authenticated' };
  }

  const { data: user, tokens } = await ssoClient.getProfileWithRefresh(Item.tokens, deviceContext);

  // Save refreshed tokens
  await dynamoDB.send(
    new PutCommand({
      TableName: 'UserSessions',
      Item: {
        userId,
        tokens,
        ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h TTL
      },
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify(user),
  };
};
```

---

## Best Practices

### 1. Always Save Refreshed Tokens

```typescript
// ❌ BAD: Ignoring refreshed tokens
const { data: user } = await ssoClient.getProfileWithRefresh(tokens, deviceContext);
// Tokens may have been refreshed but not saved!

// ✅ GOOD: Always save returned tokens
const { data: user, tokens: newTokens } = await ssoClient.getProfileWithRefresh(
  tokens,
  deviceContext
);
req.session.tokens = newTokens; // Save!
```

### 2. Check Token Expiration Before Operations

```typescript
// You can check expiration yourself
if (ssoClient.isTokenExpired(tokens.expiresAt)) {
  console.log('Token will expire soon, refreshing...');
  tokens = await ssoClient.refreshTokens(tokens.refreshToken, deviceContext);
}
```

### 3. Handle Refresh Token Expiration

```typescript
try {
  const { data, tokens } = await ssoClient.getProfileWithRefresh(
    req.session.tokens,
    deviceContext
  );
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Refresh token expired - force re-login
    delete req.session.tokens;
    return res.redirect('/login');
  }
  throw error;
}
```

### 4. Use WithRefresh Methods for Convenience

```typescript
// Simple methods: You handle refresh
const user = await ssoClient.getProfile(tokens.accessToken, deviceContext);

// WithRefresh methods: SDK handles refresh automatically (recommended!)
const { data: user, tokens } = await ssoClient.getProfileWithRefresh(tokens, deviceContext);
```

### 5. Secure Token Storage

- ✅ Use HTTP-only cookies for session IDs
- ✅ Enable HTTPS in production
- ✅ Encrypt tokens at rest if possible
- ✅ Set appropriate TTLs
- ❌ Never expose tokens to client-side JavaScript
- ❌ Never log tokens

---

## Middleware Helpers

### Express Middleware

```typescript
// Middleware to ensure user is authenticated
function requireAuth(req, res, next) {
  if (!req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Middleware to auto-refresh tokens
async function withTokenRefresh(req, res, next) {
  if (req.session.tokens) {
    try {
      // Check if refresh needed
      if (ssoClient.isTokenExpired(req.session.tokens.expiresAt)) {
        const newTokens = await ssoClient.refreshTokens(
          req.session.tokens.refreshToken,
          deviceContext
        );
        req.session.tokens = newTokens;
      }
    } catch (error) {
      // Refresh failed - clear session
      delete req.session.tokens;
      return res.status(401).json({ error: 'Session expired, please login' });
    }
  }
  next();
}

// Usage
app.get('/api/profile', requireAuth, withTokenRefresh, async (req, res) => {
  const user = await ssoClient.getProfile(req.session.tokens.accessToken, deviceContext);
  res.json(user);
});
```

---

## Common Patterns

### Request-Scoped Wrapper (NestJS-style)

```typescript
class AuthService {
  constructor(private readonly ssoClient: SSOClient) {}

  async withAuth<T>(
    tokens: TokenData,
    deviceContext: DeviceContext,
    action: (accessToken: string) => Promise<T>
  ): Promise<{ data: T; tokens: TokenData }> {
    // Ensure tokens are valid
    let validTokens = tokens;
    if (this.ssoClient.isTokenExpired(tokens.expiresAt)) {
      validTokens = await this.ssoClient.refreshTokens(tokens.refreshToken, deviceContext);
    }

    // Execute action
    const data = await action(validTokens.accessToken);

    return { data, tokens: validTokens };
  }
}

// Usage
const { data: user, tokens } = await authService.withAuth(
  req.session.tokens,
  deviceContext,
  (accessToken) => ssoClient.getProfile(accessToken, deviceContext)
);
req.session.tokens = tokens;
```

---

## Token Data Structure

```typescript
interface TokenData {
  accessToken: string; // JWT access token
  refreshToken: string; // Refresh token
  expiresAt: string; // ISO 8601 timestamp
  domain?: string; // Optional: Cookie domain
  path?: string; // Optional: Cookie path
  httpOnly?: boolean; // Optional: HTTP-only flag
}
```

---

## Migration from Stateful Design

If you're migrating from an older stateful version:

**Old (stateful)**:

```typescript
ssoClient.setTokens(tokens);
const user = await ssoClient.getProfile(deviceContext);
```

**New (stateless)**:

```typescript
// Option A: Simple
const user = await ssoClient.getProfile(tokens.accessToken, deviceContext);

// Option B: With auto-refresh
const { data: user, tokens: newTokens } = await ssoClient.getProfileWithRefresh(
  tokens,
  deviceContext
);
```

---

## See Also

- [FAQ - Token Management Questions](./faq.md#token-management)
- [Security Guide - Token Security](./security.md)
- [Examples - Working Code Samples](../examples/)
