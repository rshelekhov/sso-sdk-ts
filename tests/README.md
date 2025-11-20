# SSO SDK Testing Guide

This guide explains how to run and write tests for the SSO TypeScript SDK.

## Overview

We use a **hybrid testing approach**:

- **Unit Tests** (60%) - Fast, isolated tests for logic and utilities
- **Integration Tests** (30%) - Tests against real SSO server
- **Contract Tests** (10%) - API compatibility validation

## Quick Start

### 1. Run Unit Tests (No Server Required)

```bash
# Using Makefile (recommended)
make test-unit

# Or using bun directly
bun run test:unit

# Watch mode for development
bun run test:watch tests/unit

# Run specific test file
bun test tests/unit/token.test.ts
```

### 2. Run Integration Tests (Requires SSO Server)

**Option A: Using Makefile (Recommended)**

```bash
# Start SSO server (waits 30s automatically)
make test-up

# Run integration tests
make test-integration

# View logs if needed
make test-logs

# Stop services when done
make test-down
```

**Option B: Full Test Suite with Auto Cleanup**

```bash
# This will start server, run all tests, and cleanup
make test

# Or using bun
bun run test:full
```

**Option C: Manual Control with bun**

```bash
# Start SSO server and dependencies
bun run test:server:up

# Wait for services to be ready (~30 seconds)
# Check server health
curl -H "X-Client-Id: test-client-id" http://localhost:8080/v1/auth/.well-known/jwks.json

# Run integration tests
bun run test:integration

# Stop services when done
bun run test:server:down
```

### 3. Run All Tests

```bash
# Using Makefile (recommended)
make test

# Or using bun
bun test
```

### 4. View Help

```bash
make help
```

---

## Test Directory Structure

```
tests/
├── unit/                       # Unit tests (mocked)
│   ├── token.test.ts          # Token utility tests
│   ├── errors.test.ts         # Error handling tests
│   └── ...
│
├── integration/                # Integration tests (real SSO server)
│   ├── auth-flow.test.ts      # Authentication flow tests
│   ├── config.ts              # Test configuration
│   ├── helpers.ts             # Test utilities
│   └── ...
│
├── fixtures/                   # Mock data and responses
│   └── ...
│
├── setup/                      # Test setup/teardown
│   └── ...
│
└── README.md                   # This file
```

---

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/token.test.ts
import { describe, test, expect } from 'bun:test';
import { SSOClient } from '../../src';

describe('Token Utilities', () => {
  const client = new SSOClient({
    baseUrl: 'http://localhost:8080',
    clientId: 'test-client',
    publicUrls: {
      emailVerification: 'http://test.com/verify',
      passwordReset: 'http://test.com/reset',
    },
  });

  test('should detect expired token', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    expect(client.isTokenExpired(pastDate)).toBe(true);
  });

  test('should detect valid token', () => {
    const futureDate = new Date(Date.now() + 10000).toISOString();
    expect(client.isTokenExpired(futureDate)).toBe(false);
  });
});
```

### Integration Test Example

```typescript
// tests/integration/my-test.test.ts
import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import {
  createTestClient,
  generateTestUser,
  generateDeviceContext,
  cleanupTestUser,
  waitForServer,
} from './helpers';
import { testConfig } from './config';

describe('My Integration Test', () => {
  let tokensToCleanup: any[] = [];

  beforeAll(async () => {
    const isReady = await waitForServer();
    if (!isReady) {
      throw new Error('SSO server is not ready');
    }
  }, 60000);

  afterEach(async () => {
    const client = createTestClient();
    for (const { tokens, deviceContext } of tokensToCleanup) {
      await cleanupTestUser(client, tokens, deviceContext);
    }
    tokensToCleanup = [];
  });

  test('should complete auth flow', async () => {
    const client = createTestClient();
    const user = generateTestUser();
    const device = generateDeviceContext();

    // Register
    const result = await client.register(
      user.email,
      user.password,
      user.name,
      device
    );

    expect(result.userId).toBeDefined();
    tokensToCleanup.push({ tokens: result.tokenData, deviceContext: device });

    // Your test logic here
  }, 30000);
});
```

---

## Configuration

### Environment Variables

Create a `.env.test` file (optional):

```env
SSO_BASE_URL=http://localhost:8080
SSO_GRPC_URL=localhost:44044
TEST_CLIENT_ID=test-client-id
TEST_ISSUER=sso-service
TEST_VERIFICATION_URL=http://localhost:3000/verify-email
TEST_PASSWORD_RESET_URL=http://localhost:3000/reset-password
```

### Docker Compose Services

The `docker-compose.test.yml` includes:

- **PostgreSQL** - Database for SSO server
- **Redis** - Session/cache storage
- **MinIO** - S3-compatible storage for JWT keys
- **SSO Server** - The actual SSO service (from Docker Hub)

All services include health checks and will wait for dependencies to be ready.

---

## Troubleshooting

### SSO Server Not Starting

```bash
# Check service logs
make test-logs
# Or follow logs in real-time
make test-logs-follow

# Check if port is already in use
lsof -i :8080
lsof -i :44044

# Reset and restart
make test-down
make test-up
```

### Integration Tests Failing

1. **Ensure server is running:**
   ```bash
   # Check JWKS endpoint (SSO doesn't have /health)
   curl -H "X-Client-Id: test-client-id" http://localhost:8080/v1/auth/.well-known/jwks.json
   ```

2. **Check server logs:**
   ```bash
   make test-logs
   ```

3. **Reset environment:**
   ```bash
   make test-down
   make test-up
   ```

### Database Issues

```bash
# Reset all data (removes volumes)
make test-down

# Restart fresh
make test-up
```

---

## CI/CD Integration

Tests run automatically on GitHub Actions for:

- **Pull Requests** to `dev` and `main`
- **Pushes** to `dev` and `main`

### Workflow Steps:

1. **Lint & Type Check** - Fast syntax/type validation
2. **Unit Tests** - Run unit tests
3. **Integration Tests** - Start SSO server via Docker Compose, run integration tests

The workflow uses the same Makefile commands you use locally, ensuring consistency between local development and CI.

### Local CI Testing

You can simulate CI locally:

```bash
# Using Makefile (same as CI)
make typecheck
make format
make test

# Or step by step
bun run typecheck
bun run format:check
make test-unit
make test-up
make test-integration
make test-down
```

---

## Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
afterEach(async () => {
  // Clean up test data
  await cleanupTestUser(client, tokens, deviceContext);
});
```

### 2. Use Test Helpers

```typescript
import { generateTestUser, generateDeviceContext } from './helpers';

const user = generateTestUser(); // Random user data
const device = generateDeviceContext(); // Random device info
```

### 3. Meaningful Test Names

```typescript
test('should refresh tokens when access token expires', async () => {
  // Test implementation
});
```

### 4. Timeouts for Integration Tests

```typescript
test('my integration test', async () => {
  // Test code
}, 30000); // 30 second timeout
```

### 5. Error Testing

```typescript
test('should reject invalid credentials', async () => {
  await expect(
    client.login('wrong@example.com', 'wrongpass', device)
  ).rejects.toThrow();
});
```

---

## Performance Guidelines

- **Unit tests:** < 10ms each
- **Integration tests:** < 5s each
- **Total test suite:** < 2 minutes

---

## Coverage Goals

- **Overall:** 80%+
- **Critical paths:** 95%+ (auth flows, token refresh, error handling)

---

## Useful Commands

### Using Makefile (Recommended)

```bash
# Testing
make test              # Run all tests (starts/stops server automatically)
make test-unit         # Unit tests only
make test-integration  # Integration tests only (requires running server)

# Server Management
make test-up           # Start SSO server
make test-down         # Stop SSO server
make test-logs         # View server logs (last 100 lines)
make test-logs-follow  # Follow server logs in real-time

# Development
make install           # Install dependencies
make build             # Build the SDK
make typecheck         # Run type checking
make format            # Format code
make help              # Show all commands
```

### Using Bun Directly

```bash
# Development
bun run test:watch              # Watch mode for TDD
bun test tests/unit/token.test.ts  # Run specific file

# Server Management
bun run test:server:up          # Start SSO server
bun run test:server:down        # Stop SSO server
bun run test:server:logs        # View server logs

# Testing
bun run test:unit               # Unit tests only
bun run test:integration        # Integration tests only
bun run test                    # All tests
bun run test:coverage           # With coverage

# Quality Checks
bun run typecheck               # Type checking
bun run format                  # Format code
bun run format:check            # Check formatting

# Full Suite
bun run test:full               # Start server → test → cleanup
```

---

## Need Help?

- See [TESTING_STRATEGY.md](../TESTING_STRATEGY.md) for detailed testing strategy
- Check example tests in `tests/unit/` and `tests/integration/`
- Review GitHub Actions workflow at `.github/workflows/test.yml`

---

## Summary

✅ **Fast feedback** with unit tests (no server needed)
✅ **Real validation** with integration tests (Docker Compose)
✅ **Automated CI/CD** on every PR and merge
✅ **Easy local development** with helper scripts

Happy testing! 🎉
