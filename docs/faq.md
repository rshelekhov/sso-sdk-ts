# Frequently Asked Questions (FAQ)

## Design Philosophy

### Q: Why doesn't the SDK store tokens automatically?

**A**: The SDK follows a **stateless design** similar to Go's `http.Client`. Here's why:

1. **Multi-user backends**: A single SDK instance can safely handle requests from thousands of different users concurrently
2. **Platform agnostic**: You control where tokens are stored (Redis, PostgreSQL, DynamoDB, etc.)
3. **No forced dependencies**: We don't impose specific storage solutions
4. **Thread-safe**: The client can be reused across all requests without race conditions

**Best practice**: Create `SSOClient` once at startup, pass tokens as function parameters.

---

## Usage Patterns

### Q: How do I handle multiple users?

**A**: The SDK is designed for multi-user environments. Create the client **ONCE** and reuse it:

```typescript
// ✅ CORRECT: Create once at startup (like Go's http.Client)
const ssoClient = new SSOClient({
  baseUrl: process.env.SSO_URL,
  clientId: process.env.CLIENT_ID,
  publicUrls: {
    emailVerification: process.env.VERIFICATION_URL,
    passwordReset: process.env.RESET_URL,
  },
});

// Then in each request handler:
app.get('/api/profile', async (req, res) => {
  // Load tokens for THIS user from session/database
  const tokens = req.session.tokens;

  // Pass tokens as parameter (stateless!)
  const { data: user, tokens: newTokens } = await ssoClient.getProfileWithRefresh(
    tokens,
    deviceContext
  );

  // Save updated tokens (may have been refreshed)
  req.session.tokens = newTokens;

  res.json(user);
});
```

**Why this works**:
- ✅ **Safe**: No race conditions - each request uses different tokens
- ✅ **Efficient**: Client created once, not per-request
- ✅ **Scalable**: Handles thousands of concurrent users
- ✅ **Stateless**: Like Go's `http.Client` or AWS SDK

**⚠️ Do NOT create a new client per request** - it's unnecessary overhead. The client itself has no user-specific state.

---

### Q: Should I create a new SSOClient for each request?

**A**: **No!** Unlike the old stateful design, you should now:

```typescript
// ✅ DO THIS: Create once, reuse everywhere
const ssoClient = new SSOClient(config);

app.get('/profile', async (req, res) => {
  const user = await ssoClient.getProfile(req.session.tokens.accessToken, deviceContext);
  res.json(user);
});
```

**Not this:**

```typescript
// ❌ DON'T DO THIS: Wasteful per-request creation
app.get('/profile', async (req, res) => {
  const ssoClient = new SSOClient(config);  // ← Unnecessary!
  const user = await ssoClient.getProfile(req.session.tokens.accessToken, deviceContext);
  res.json(user);
});
```

The client is now **stateless** - it doesn't store any user-specific data, so it's safe to share.

---

## Token Management

### Q: How do I handle token refresh?

**A**: The SDK provides two approaches:

**Option 1: Manual refresh** (you control when to refresh):

```typescript
const user = await ssoClient.getProfile(tokens.accessToken, deviceContext);
```

**Option 2: Auto-refresh** (SDK refreshes automatically if expired):

```typescript
const { data: user, tokens: newTokens } = await ssoClient.getProfileWithRefresh(
  tokens,
  deviceContext
);

// IMPORTANT: Always save the returned tokens!
req.session.tokens = newTokens;
```

Use `WithRefresh` methods for convenience - the SDK automatically refreshes expired tokens and returns the new ones.

---

### Q: What happens if the refresh token expires?

**A**: The `refreshTokens()` method (or any `WithRefresh` method) will throw an error:

```typescript
try {
  const { data: user, tokens } = await ssoClient.getProfileWithRefresh(
    req.session.tokens,
    deviceContext
  );
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Refresh token expired - user must log in again
    return res.redirect('/login');
  }
  throw error;
}
```

The user must log in again to get new tokens.

---

## Browser vs Backend

### Q: Can I use this SDK in the browser (React/Vue/Angular)?

**A**: **No.** This is a **backend SDK** for the following reasons:

1. **Requires server-side context**: Needs real client IP and user agent from HTTP requests
2. **Security**: Should not expose client credentials to the browser
3. **Token storage**: Backend databases/sessions are more secure than browser storage

**For frontend apps**, use:
- Standard OAuth2 authorization code flow
- Frontend-specific SDKs (if available)
- Direct API calls with proper CORS configuration

---

## Advanced Topics

### Q: How do I verify JWT tokens myself?

**A**: Your SSO service exposes a JWKS (JSON Web Key Set) endpoint:

```typescript
// Get public keys for JWT verification
const jwks = await fetch('http://your-sso/v1/auth/.well-known/jwks.json');
const keys = await jwks.json();

// Use a JWT library to verify tokens
import { jwtVerify, createRemoteJWKSet } from 'jose';

const JWKS = createRemoteJWKSet(new URL('http://your-sso/v1/auth/.well-known/jwks.json'));

const { payload } = await jwtVerify(accessToken, JWKS);
console.log(payload); // { user_id, email, client_id, exp, ... }
```

This is useful when:
- You want to validate tokens without calling the SSO service
- You're implementing microservices that need to verify tokens independently
- You need to extract claims from tokens

---

### Q: How do I implement request-scoped instances (NestJS, etc.)?

**A**: While a global instance works perfectly, some frameworks offer request-scoped DI:

**NestJS Example:**

```typescript
@Injectable({ scope: Scope.REQUEST })
export class SSOService {
  private tokens: TokenData;

  constructor(
    @Inject('SSO_CLIENT') private readonly ssoClient: SSOClient,
    @Inject(REQUEST) private readonly request: Request
  ) {
    // Load tokens from request context
    this.tokens = this.request.session.tokens;
  }

  async getProfile() {
    const { data, tokens } = await this.ssoClient.getProfileWithRefresh(
      this.tokens,
      this.getDeviceContext()
    );

    // Update session with refreshed tokens
    this.request.session.tokens = tokens;
    return data;
  }
}
```

This provides a convenient wrapper while still using the shared stateless client underneath.

---

### Q: How do I handle concurrent requests for the same user?

**A**: Token refresh is idempotent and safe:

```typescript
// Both requests happen simultaneously for User A
// Request 1: getProfileWithRefresh() → refreshes token
// Request 2: getProfileWithRefresh() → refreshes token

// Both will succeed! The SSO server handles this correctly.
// You'll get two sets of valid tokens - both work fine.
// Just save whichever one completes last.
```

The SSO server is designed to handle concurrent refresh requests safely.

---

## Migration from Stateful Design

### Q: I was told to create a new client per request. Why did that change?

**A**: The SDK was refactored from a **stateful** to a **stateless** design:

**Old design (stateful)**:
```typescript
// ❌ OLD: Had to create per-request to avoid race conditions
const client = new SSOClient(config);
client.setTokens(tokens);  // Stored in instance
await client.getProfile(); // Used stored tokens
```

**New design (stateless)**:
```typescript
// ✅ NEW: Pass tokens as parameters, safe to share
const client = new SSOClient(config); // Once at startup
await client.getProfile(tokens.accessToken, deviceContext); // Stateless
```

The new design is:
- ✅ More efficient (no per-request allocation)
- ✅ Safer (no shared state, no race conditions)
- ✅ More familiar (matches Go, Java, Python patterns)

---

### Q: Do the `WithRefresh` methods affect other concurrent requests?

**A**: **No!** Each method call is completely isolated:

```typescript
// User A and User B's requests happening at the same time
const ssoClient = new SSOClient(config); // Shared client

// Request A (User A)
const resultA = await ssoClient.getProfileWithRefresh(userA_tokens, contextA);
// Returns User A's data + User A's tokens

// Request B (User B) - happening simultaneously
const resultB = await ssoClient.getProfileWithRefresh(userB_tokens, contextB);
// Returns User B's data + User B's tokens

// No interference - completely safe!
```

The client has **zero state** - it's just a collection of stateless functions.

---

## Performance

### Q: Is it wasteful to pass tokens on every call?

**A**: No! Passing tokens is extremely cheap:

- Tokens are small objects (~500 bytes)
- JavaScript passes objects by reference (no copying)
- Cost: ~0.0001ms (negligible)

Compare this to:
- Database query: ~5-50ms (50,000x slower)
- SSO API call: ~100ms (1,000,000x slower)

The actual API calls dominate performance - parameter passing is irrelevant.

---

## Troubleshooting

### Q: I'm getting "Not authenticated" errors

**Check these common issues:**

1. **Tokens not loaded**: Make sure you're loading tokens from storage
   ```typescript
   const tokens = req.session.tokens; // ← Are these defined?
   ```

2. **Tokens expired**: Use `WithRefresh` methods or check expiration manually
   ```typescript
   if (ssoClient.isTokenExpired(tokens.expiresAt)) {
     // Token is expired!
   }
   ```

3. **Tokens not saved**: After refresh, you must save the new tokens
   ```typescript
   const { data, tokens: newTokens } = await ssoClient.getProfileWithRefresh(...);
   req.session.tokens = newTokens; // ← Don't forget this!
   ```

---

### Q: How do I debug token issues?

```typescript
// Log token status (don't log the actual tokens!)
console.log({
  hasTokens: !!tokens,
  isExpired: tokens ? ssoClient.isTokenExpired(tokens.expiresAt) : null,
  expiresAt: tokens?.expiresAt,
  timeUntilExpiry: tokens
    ? new Date(tokens.expiresAt).getTime() - Date.now()
    : null,
});
```

**Never log actual tokens** - they're bearer credentials!

---

## Still Have Questions?

Check the following resources:
- [Token Storage Guide](./token-storage.md) - How to persist tokens
- [Security Guide](./security.md) - Security best practices
- [Testing Guide](./testing.md) - How to test with the SDK
- [Examples](../examples/) - Working code examples

Or open an issue on GitHub!
