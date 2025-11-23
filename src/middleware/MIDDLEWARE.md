# Authentication Middleware

The SSO SDK provides authentication middleware for popular Node.js frameworks. The middleware validates JWT tokens issued by your SSO server using JWKS (JSON Web Key Sets).

## Features

- ✅ **JWT validation** using JWKS from your SSO server
- ✅ **Automatic JWKS caching** (default: 1 hour TTL)
- ✅ **Multiple token sources**: Authorization header and cookies
- ✅ **Framework adapters**: Express, Fastify, Hono, NestJS
- ✅ **Type-safe** with full TypeScript support
- ✅ **Zero configuration** for standard setups

## Quick Start

### 1. Configuration

All middleware adapters share the same configuration:

```typescript
import { AuthMiddleware } from '@rshelekhov/sso-sdk';

const auth = new AuthMiddleware({
  // Required: URL to your SSO server's JWKS endpoint
  jwksUrl: 'https://sso.example.com/v1/auth/.well-known/jwks.json',

  // Required: Expected token issuer (must match "iss" claim)
  issuer: 'https://sso.example.com',

  // Required: Expected audience (must match "aud" claim)
  // This is your application's client ID
  audience: 'my-api-service',

  // Optional: JWKS cache TTL in milliseconds (default: 3600000 / 1 hour)
  jwksCacheTTL: 3600000,

  // Optional: Whether to check cookies for access token (default: true)
  cookieAuth: true,

  // Optional: Cookie name for access token (default: "access_token")
  cookieName: 'access_token',
});
```

### 2. Framework-Specific Usage

## Express

```typescript
import express from 'express';
import { AuthMiddleware, type AuthenticatedRequest } from '@rshelekhov/sso-sdk';

const app = express();

const auth = new AuthMiddleware({
  jwksUrl: 'https://sso.example.com/v1/auth/.well-known/jwks.json',
  issuer: 'https://sso.example.com',
  audience: 'my-api-service',
});

// Protect specific routes
app.get(
  '/api/profile',
  auth.express(),
  (req: AuthenticatedRequest, res) => {
    // Access validated claims
    const { user_id, email, roles } = req.ssoUser;
    res.json({ userId: user_id, email, roles });
  }
);

// Protect all routes under /api
app.use('/api', auth.express());
```

## Fastify

```typescript
import Fastify from 'fastify';
import { AuthMiddleware, type AuthenticatedRequest } from '@rshelekhov/sso-sdk';

const fastify = Fastify();

const auth = new AuthMiddleware({
  jwksUrl: 'https://sso.example.com/v1/auth/.well-known/jwks.json',
  issuer: 'https://sso.example.com',
  audience: 'my-api-service',
});

// Apply globally
fastify.addHook('preHandler', auth.fastify());

// Access in routes
fastify.get('/api/profile', async (request: AuthenticatedRequest, reply) => {
  const { user_id, email } = request.ssoUser;
  return { userId: user_id, email };
});
```

## Hono

```typescript
import { Hono } from 'hono';
import { AuthMiddleware } from '@rshelekhov/sso-sdk';

const app = new Hono();

const auth = new AuthMiddleware({
  jwksUrl: 'https://sso.example.com/v1/auth/.well-known/jwks.json',
  issuer: 'https://sso.example.com',
  audience: 'my-api-service',
});

// Protect specific routes
app.use('/api/*', auth.hono());

// Access in handlers
app.get('/api/profile', (c) => {
  const user = c.get('ssoUser');
  return c.json({ userId: user.user_id, email: user.email });
});
```

## NestJS

```typescript
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { SSOAuthGuard, type RequestWithSSO } from '@rshelekhov/sso-sdk';

// Create guard instance
const auth = new SSOAuthGuard({
  jwksUrl: 'https://sso.example.com/v1/auth/.well-known/jwks.json',
  issuer: 'https://sso.example.com',
  audience: 'my-api-service',
});

@Controller('api')
export class ApiController {
  @Get('profile')
  @UseGuards(auth)
  getProfile(@Req() req: RequestWithSSO) {
    return {
      userId: req.ssoUser.user_id,
      email: req.ssoUser.email,
      roles: req.ssoUser.roles
    };
  }
}
```

## JWT Claims Structure

The validated token claims are attached to the request and follow this structure:

```typescript
interface JWTClaims {
  // Standard JWT claims
  sub: string;                 // Subject (user ID)
  iss: string;                 // Issuer (SSO server URL)
  aud: string | string[];      // Audience (client IDs)
  exp: number;                 // Expiration time (Unix timestamp)
  iat: number;                 // Issued at (Unix timestamp)
  nbf?: number;                // Not before (Unix timestamp)

  // Custom SSO claims
  user_id: string;             // User identifier
  email?: string;              // User email
  client_id?: string;          // Client application ID
  device_id?: string;          // Device identifier
  roles?: string[];            // User roles

  // Additional custom claims
  [key: string]: unknown;
}
```

## Token Sources

The middleware searches for tokens in this order:

1. **Authorization header**: `Authorization: Bearer <token>`
2. **Cookie** (if `cookieAuth` is enabled): Cookie with name from `cookieName`

## Error Handling

The middleware returns 401 Unauthorized with a JSON error message for:

- Missing token
- Expired token
- Invalid signature
- Invalid claims (issuer/audience mismatch)
- Malformed token

### Express/Fastify/Hono

```json
{
  "error": "Token has expired"
}
```

### NestJS

NestJS returns a standard 403 Forbidden response when the guard returns `false`.

## Advanced Usage

### Custom Error Handling (Express)

```typescript
import { AuthError, AuthErrorType } from '@rshelekhov/sso-sdk';

app.use('/api', (req, res, next) => {
  auth.express()(req, res, (error) => {
    if (error instanceof AuthError) {
      // Custom error response
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        type: error.type,
      });
    }
    next(error);
  });
});
```

### Role-Based Authorization

```typescript
app.get(
  '/admin/users',
  auth.express(),
  (req: AuthenticatedRequest, res, next) => {
    // Check roles
    if (!req.ssoUser?.roles?.includes('admin')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  },
  (req, res) => {
    // Admin-only handler
    res.json({ users: [] });
  }
);
```

### JWKS Caching

JWKS responses are automatically cached to reduce load on your SSO server:

- Default TTL: 1 hour (3600000ms)
- Configurable via `jwksCacheTTL` option
- Uses the `jose` library's built-in caching mechanism

## Security Best Practices

1. **Always use HTTPS** for your SSO server
2. **Validate audience** - Set `audience` to your specific client ID
3. **Validate issuer** - Set `issuer` to your SSO server URL
4. **Use HttpOnly cookies** when possible for web applications
5. **Set appropriate JWKS cache TTL** - Balance between performance and security

## Troubleshooting

### "No authentication token found"

- Check that the client is sending the token in the Authorization header
- If using cookies, ensure `cookieAuth: true` and `cookieName` is correct

### "Invalid issuer" or "Invalid audience"

- Verify `issuer` matches the `iss` claim in your JWT
- Verify `audience` matches the `aud` claim in your JWT

### "Failed to fetch JWKS"

- Check that `jwksUrl` is accessible from your server
- Verify your SSO server is running and the JWKS endpoint is available
- Check network/firewall rules

### "JWK with kid not found"

- The token's `kid` (Key ID) doesn't match any keys in JWKS
- Your SSO server may have rotated keys - wait for cache to expire or restart your app

## Examples

See the `/examples` directory for complete working examples:

- `/examples/express` - Express.js example
- `/examples/fastify` - Fastify example
- `/examples/hono` - Hono example
- `/examples/nestjs` - NestJS example

## License

MIT
