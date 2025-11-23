/**
 * Integration tests for authentication middleware
 * Requires SSO server to be running (use docker-compose.test.yml)
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { DeviceContext, TokenData } from '../../src';
import { AuthError, AuthErrorType, AuthMiddleware, JWTVerifier } from '../../src/middleware';
import { testConfig } from './config';
import {
  cleanupTestUser,
  createTestClient,
  generateDeviceContext,
  generateTestUser,
  waitForServer,
} from './helpers';

describe('JWT Middleware - Integration', () => {
  let tokensToCleanup: { tokens: TokenData; deviceContext: DeviceContext }[] = [];
  let authMiddleware: AuthMiddleware;

  // Wait for SSO server to be ready before running tests
  beforeAll(async () => {
    const isReady = await waitForServer(30, 2000);
    if (!isReady) {
      throw new Error(
        'SSO server is not ready. Please start it with: docker-compose -f docker-compose.test.yml up -d'
      );
    }

    // Initialize auth middleware with test config
    authMiddleware = new AuthMiddleware({
      jwksUrl: `${testConfig.ssoBaseUrl}/v1/auth/.well-known/jwks.json`,
      issuer: testConfig.issuer,
      audience: testConfig.clientId,
      clientId: testConfig.clientId,
    });
  }, testConfig.serverStartupTimeout);

  // Cleanup after each test
  afterEach(async () => {
    const client = createTestClient();
    for (const { tokens, deviceContext } of tokensToCleanup) {
      await cleanupTestUser(client, tokens, deviceContext);
    }
    tokensToCleanup = [];
  });

  describe('JWTVerifier', () => {
    test(
      'should verify valid token from SSO server',
      async () => {
        const client = createTestClient();
        const testUser = generateTestUser();
        const deviceContext = generateDeviceContext();

        // Register to get a valid token
        const registerResult = await client.register(
          testUser.email,
          testUser.password,
          testUser.name,
          deviceContext
        );

        if (!registerResult.tokenData) {
          throw new Error('Expected tokenData to be present after registration');
        }
        const tokens = registerResult.tokenData;
        tokensToCleanup.push({ tokens, deviceContext });

        // Validate token using middleware
        const result = await authMiddleware.validateToken(
          `Bearer ${tokens.accessToken}`,
          undefined
        );

        expect(result.claims).toBeDefined();
        expect(result.claims.user_id).toBe(registerResult.userId);
        expect(result.claims.iss).toBe(testConfig.issuer);
        // SSO server uses client_id instead of aud
        expect(result.claims.client_id).toBe(testConfig.clientId);
        expect(result.token).toBe(tokens.accessToken);

        // Cleanup
        await client.logout(tokens.accessToken, deviceContext);
        tokensToCleanup = [];
      },
      testConfig.defaultTimeout
    );

    test(
      'should reject invalid token',
      async () => {
        const invalidToken = 'invalid.jwt.token';

        await expect(
          authMiddleware.validateToken(`Bearer ${invalidToken}`, undefined)
        ).rejects.toThrow(AuthError);
      },
      testConfig.defaultTimeout
    );

    test(
      'should reject token with wrong audience',
      async () => {
        const client = createTestClient();
        const testUser = generateTestUser();
        const deviceContext = generateDeviceContext();

        // Register to get a valid token
        const registerResult = await client.register(
          testUser.email,
          testUser.password,
          testUser.name,
          deviceContext
        );

        if (!registerResult.tokenData) {
          throw new Error('Expected tokenData to be present after registration');
        }
        const tokens = registerResult.tokenData;
        tokensToCleanup.push({ tokens, deviceContext });

        // Create middleware with wrong audience
        const wrongAudienceMiddleware = new AuthMiddleware({
          jwksUrl: `${testConfig.ssoBaseUrl}/v1/auth/.well-known/jwks.json`,
          issuer: testConfig.issuer,
          audience: 'wrong-audience',
          clientId: testConfig.clientId,
        });

        await expect(
          wrongAudienceMiddleware.validateToken(`Bearer ${tokens.accessToken}`, undefined)
        ).rejects.toThrow();

        // Cleanup
        await client.logout(tokens.accessToken, deviceContext);
        tokensToCleanup = [];
      },
      testConfig.defaultTimeout
    );

    test(
      'should throw TOKEN_NOT_FOUND when no token provided',
      async () => {
        try {
          await authMiddleware.validateToken(undefined, undefined);
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(AuthError);
          expect((error as AuthError).type).toBe(AuthErrorType.TOKEN_NOT_FOUND);
        }
      },
      testConfig.defaultTimeout
    );
  });

  describe('Token Extraction', () => {
    test('should extract token from Authorization header', () => {
      const token = 'test-token-value';
      const result = JWTVerifier.extractFromHeader(`Bearer ${token}`);
      expect(result).toBe(token);
    });

    test('should return null for invalid Authorization header', () => {
      expect(JWTVerifier.extractFromHeader('Invalid header')).toBeNull();
      expect(JWTVerifier.extractFromHeader('Bearer')).toBeNull();
      expect(JWTVerifier.extractFromHeader('')).toBeNull();
      expect(JWTVerifier.extractFromHeader(null)).toBeNull();
    });

    test('should extract token from cookie', () => {
      const token = 'cookie-token-value';
      const cookies = `other=value; access_token=${token}; another=test`;
      const result = JWTVerifier.extractFromCookie(cookies, 'access_token');
      expect(result).toBe(token);
    });

    test('should return null when cookie not found', () => {
      const cookies = 'other=value; another=test';
      expect(JWTVerifier.extractFromCookie(cookies, 'access_token')).toBeNull();
      expect(JWTVerifier.extractFromCookie(undefined, 'access_token')).toBeNull();
    });
  });

  describe('Framework Adapters', () => {
    test(
      'should work with Hono middleware pattern',
      async () => {
        const client = createTestClient();
        const testUser = generateTestUser();
        const deviceContext = generateDeviceContext();

        // Register to get a valid token
        const registerResult = await client.register(
          testUser.email,
          testUser.password,
          testUser.name,
          deviceContext
        );

        if (!registerResult.tokenData) {
          throw new Error('Expected tokenData to be present after registration');
        }
        const tokens = registerResult.tokenData;
        tokensToCleanup.push({ tokens, deviceContext });

        // Mock Hono context
        let ssoUser: any = null;
        let ssoToken = '';
        let nextCalled = false;

        const mockContext = {
          req: {
            header: (name: string) => {
              if (name === 'authorization') {
                return `Bearer ${tokens.accessToken}`;
              }
              return undefined;
            },
          },
          set: (key: string, value: unknown) => {
            if (key === 'ssoUser') {
              ssoUser = value;
            }
            if (key === 'ssoToken') {
              ssoToken = value as string;
            }
          },
          json: (obj: { error: string }, status: number) => {
            return new Response(JSON.stringify(obj), { status });
          },
        };

        const middleware = authMiddleware.hono();
        await middleware(mockContext, async () => {
          nextCalled = true;
        });

        expect(nextCalled).toBe(true);
        expect(ssoUser).toBeDefined();
        expect(ssoUser.user_id).toBe(registerResult.userId);
        expect(ssoToken).toBe(tokens.accessToken);

        // Cleanup
        await client.logout(tokens.accessToken, deviceContext);
        tokensToCleanup = [];
      },
      testConfig.defaultTimeout
    );

    test(
      'should work with Express middleware pattern',
      async () => {
        const client = createTestClient();
        const testUser = generateTestUser();
        const deviceContext = generateDeviceContext();

        // Register to get a valid token
        const registerResult = await client.register(
          testUser.email,
          testUser.password,
          testUser.name,
          deviceContext
        );

        if (!registerResult.tokenData) {
          throw new Error('Expected tokenData to be present after registration');
        }
        const tokens = registerResult.tokenData;
        tokensToCleanup.push({ tokens, deviceContext });

        // Mock Express request/response
        const mockReq: any = {
          headers: {
            authorization: `Bearer ${tokens.accessToken}`,
          },
        };

        let nextCalled = false;
        let nextError: Error | undefined;
        const mockRes = {
          status: (_code: number) => ({
            json: (_body: { error: string }) => {},
          }),
        };
        const mockNext = (error?: Error) => {
          nextCalled = true;
          nextError = error;
        };

        const middleware = authMiddleware.express();
        await middleware(mockReq, mockRes, mockNext);

        expect(nextCalled).toBe(true);
        expect(nextError).toBeUndefined();
        expect(mockReq.ssoUser).toBeDefined();
        expect(mockReq.ssoUser.user_id).toBe(registerResult.userId);
        expect(mockReq.ssoToken).toBe(tokens.accessToken);

        // Cleanup
        await client.logout(tokens.accessToken, deviceContext);
        tokensToCleanup = [];
      },
      testConfig.defaultTimeout
    );

    test(
      'should work with Fastify middleware pattern',
      async () => {
        const client = createTestClient();
        const testUser = generateTestUser();
        const deviceContext = generateDeviceContext();

        // Register to get a valid token
        const registerResult = await client.register(
          testUser.email,
          testUser.password,
          testUser.name,
          deviceContext
        );

        if (!registerResult.tokenData) {
          throw new Error('Expected tokenData to be present after registration');
        }
        const tokens = registerResult.tokenData;
        tokensToCleanup.push({ tokens, deviceContext });

        // Mock Fastify request/reply
        const mockRequest: any = {
          headers: {
            authorization: `Bearer ${tokens.accessToken}`,
          },
        };

        let replySent = false;
        const mockReply = {
          code: (_statusCode: number) => ({
            send: (_payload: { error: string }) => {
              replySent = true;
            },
          }),
        };

        const middleware = authMiddleware.fastify();
        await middleware(mockRequest, mockReply);

        expect(replySent).toBe(false); // Should not send error response
        expect(mockRequest.ssoUser).toBeDefined();
        expect(mockRequest.ssoUser.user_id).toBe(registerResult.userId);
        expect(mockRequest.ssoToken).toBe(tokens.accessToken);

        // Cleanup
        await client.logout(tokens.accessToken, deviceContext);
        tokensToCleanup = [];
      },
      testConfig.defaultTimeout
    );

    test(
      'should return 401 for missing token in Hono middleware',
      async () => {
        const mockContext = {
          req: {
            header: () => undefined,
          },
          set: () => {},
          json: (obj: { error: string }, status: number) => {
            return new Response(JSON.stringify(obj), { status });
          },
        };

        const middleware = authMiddleware.hono();
        const response = await middleware(mockContext, async () => {});

        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(401);
      },
      testConfig.defaultTimeout
    );
  });
});
