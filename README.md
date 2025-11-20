# SSO SDK for TypeScript

A robust, type-safe TypeScript SDK for integrating with the [SSO service](https://github.com/rshelekhov/sso). Designed for backend applications (Node.js, Bun, Deno) with framework-agnostic token management.

## Features

*   🔒 **Secure by Default**: Automatic token refresh and secure defaults.
*   💾 **Storage Agnostic**: In-memory token management with hooks for any storage backend (Session, Redis, DB).
*   🚀 **Framework Independent**: Works with Express, Fastify, Hono, NestJS, and more.
*   📦 **Type-Safe**: Full TypeScript support with comprehensive types.

## Installation

```bash
npm install @sso-sdk/client
# or
bun add @sso-sdk/client
```

## Quick Start

### 1. Initialize the Client

```typescript
import { SSOClient, Platform } from '@sso-sdk/client';

const ssoClient = new SSOClient({
  baseUrl: 'https://api.sso-service.com',
  clientId: 'your-client-id',
  publicUrls: {
    emailVerification: 'https://yourapp.com/verify-email',
    passwordReset: 'https://yourapp.com/reset-password'
  }
});
```

### 2. Login and Store Tokens

```typescript
// In your login route handler
const deviceContext = {
  platform: Platform.WEB,
  clientIP: req.ip,
  userAgent: req.headers['user-agent']
};

const tokens = await ssoClient.login('user@example.com', 'password', deviceContext);

// Store tokens in your session (implementation depends on your framework)
req.session.tokens = tokens;
```

### 3. Protect Routes

```typescript
// In your protected route middleware
const tokens = req.session.tokens;

if (!tokens) {
  return res.status(401).send('Unauthorized');
}

// Load tokens into SDK
ssoClient.setTokens(tokens);

try {
  // This will automatically refresh the token if needed
  const user = await ssoClient.getProfile(deviceContext);
  
  // Check if tokens were refreshed and save them if so
  const newTokens = ssoClient.getTokens();
  if (newTokens) {
    req.session.tokens = newTokens;
  }
  
  res.json(user);
} catch (error) {
  res.status(401).send('Session expired');
}
```

## Token Storage

The SDK manages tokens in-memory to give you full control over persistence. You are responsible for:
1.  Saving tokens to your storage (Session, Redis, etc.) after login or refresh.
2.  Loading tokens into the SDK before making authenticated requests.

👉 **[Read the Token Storage Guide](docs/token-storage.md)** for detailed patterns and examples.

## Documentation

*   [Token Storage Patterns](docs/token-storage.md)
*   [Testing Guide](tests/README.md) - How to run and write tests
*   [Security Guide](docs/security.md) (Coming Soon)
*   [API Reference](docs/api-reference.md) (Coming Soon)

## Examples

*   [Express.js](examples/express) (Coming Soon)
*   [Fastify](examples/fastify) (Coming Soon)
*   [Hono](examples/hono) (Coming Soon)
*   [NestJS](examples/nestjs) (Coming Soon)

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- [Docker](https://www.docker.com/) (for integration tests)

### Setup

```bash
# Clone the repository
git clone https://github.com/rshelekhov/sso-sdk-ts.git
cd sso-sdk-ts

# Install dependencies
make install

# Build the SDK
make build
```

### Testing

```bash
# Run all tests (starts server, runs tests, stops server)
make test

# Run only unit tests (fast, no server needed)
make test-unit

# Run only integration tests (requires SSO server)
make test-up           # Start SSO server
make test-integration  # Run integration tests
make test-down         # Stop SSO server

# View server logs
make test-logs

# Show all available commands
make help
```

For detailed testing instructions, see [tests/README.md](tests/README.md).

### Code Quality

```bash
# Type checking
make typecheck

# Format code
make format
```
