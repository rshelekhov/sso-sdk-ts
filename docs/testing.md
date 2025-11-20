# Testing Guide

This guide explains how to test applications that use the SSO SDK.

## Mocking the SSO Client

When testing your application, you should mock the `SSOClient` to avoid making actual network requests to the SSO service.

### Jest Example

```typescript
// __mocks__/@sso-sdk/client.ts
export const SSOClient = jest.fn().mockImplementation(() => ({
  login: jest.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 3600000,
  }),
  getProfile: jest.fn().mockResolvedValue({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  }),
  isAuthenticated: jest.fn().mockReturnValue(true),
  setTokens: jest.fn(),
  getTokens: jest.fn(),
  logout: jest.fn().mockResolvedValue('Logged out'),
}));
```

### Usage in Tests

```typescript
import { SSOClient } from '@sso-sdk/client';
import request from 'supertest';
import app from '../src/app'; // Your Express/Fastify app

jest.mock('@sso-sdk/client');

describe('Auth Routes', () => {
  it('should login successfully', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'test@example.com', password: 'password' });

    expect(response.status).toBe(200);
    expect(SSOClient).toHaveBeenCalled();
  });
});
```

## Integration Testing

For integration tests where you want to test the flow with a real (or emulated) SSO service:

1.  **Mock Server**: Create a simple HTTP server that mimics the SSO API endpoints (`/auth/login`, `/user/profile`, etc.).
2.  **Configure Client**: Point the `SSOClient` `baseUrl` to your mock server.

```typescript
const mockServer = setupServer(
  rest.post('http://localhost:8080/auth/login', (req, res, ctx) => {
    return res(ctx.json({ accessToken: '...' }));
  })
);

beforeAll(() => mockServer.listen());
afterAll(() => mockServer.close());
```

## Testing Token Refresh

To test token refresh logic:

1.  Mock `getProfile` to throw an error or return 401 initially.
2.  Mock `refreshTokens` to return a new token pair.
3.  Verify that your application handles the refresh and retries the request.

```typescript
const mockClient = new SSOClient(...);
jest.spyOn(mockClient, 'getProfile')
  .mockRejectedValueOnce(new Error('Token expired'))
  .mockResolvedValueOnce({ id: '123' }); // Success on retry
```
