/**
 * Integration tests for authentication flow
 * Requires SSO server to be running (use docker-compose.test.yml)
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';

import { testConfig } from './config';
import {
  cleanupTestUser,
  createTestClient,
  generateDeviceContext,
  generateTestUser,
  parseJWT,
  sleep,
  waitForServer,
} from './helpers';

import { TokenData } from '../../src';

describe('Authentication Flow - Integration', () => {
  let tokensToCleanup: { tokens: TokenData; deviceContext: any }[] = [];

  // Wait for SSO server to be ready before running tests
  beforeAll(async () => {
    const isReady = await waitForServer(30, 2000);
    if (!isReady) {
      throw new Error(
        'SSO server is not ready. Please start it with: docker-compose -f docker-compose.test.yml up -d'
      );
    }
  }, testConfig.serverStartupTimeout);

  // Cleanup after each test
  afterEach(async () => {
    const client = createTestClient();
    for (const { tokens, deviceContext } of tokensToCleanup) {
      await cleanupTestUser(client, tokens, deviceContext);
    }
    tokensToCleanup = [];
  });

  test(
    'should complete full auth flow: Register → Login → Profile → Logout',
    async () => {
      const client = createTestClient();
      const testUser = generateTestUser();
      const deviceContext = generateDeviceContext();

      // 1. Register new user
      const registerResult = await client.register(
        testUser.email,
        testUser.password,
        testUser.name,
        deviceContext
      );

      expect(registerResult.userId).toBeDefined();
      expect(registerResult.userId).toBeTruthy();
      expect(registerResult.userId.length).toBeGreaterThan(0);
      expect(registerResult.tokenData).toBeDefined();

      let tokens = registerResult.tokenData!;
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresAt).toBeDefined();

      // Queue for cleanup
      tokensToCleanup.push({ tokens, deviceContext });

      // 2. Login with same credentials
      const loginTokens = await client.login(testUser.email, testUser.password, deviceContext);

      expect(loginTokens.accessToken).toBeDefined();
      expect(loginTokens.refreshToken).toBeDefined();
      expect(loginTokens.expiresAt).toBeDefined();
      tokens = loginTokens;

      // 3. Get user profile with auto-refresh
      const { data: profile, tokens: refreshedTokens } = await client.getProfileWithRefresh(
        tokens,
        deviceContext
      );

      expect(profile.email).toBe(testUser.email.toLowerCase());
      expect(profile.name).toBe(testUser.name);
      expect(profile.id).toBe(registerResult.userId);
      tokens = refreshedTokens;

      // 4. Parse JWT to verify claims
      const jwtPayload = parseJWT(tokens.accessToken);
      expect(jwtPayload.iss).toBe(testConfig.issuer);
      expect(jwtPayload.client_id).toBe(testConfig.clientId);
      expect(jwtPayload.user_id).toBe(registerResult.userId);
      expect(jwtPayload.exp).toBeGreaterThan(Date.now() / 1000);

      // 5. Logout
      await client.logout(tokens.accessToken, deviceContext);

      // 6. Verify session is invalidated - refresh should fail
      // Note: Access tokens (JWT) remain valid until expiry even after logout
      // But the refresh token session should be deleted
      await expect(client.refreshTokens(tokens.refreshToken, deviceContext)).rejects.toThrow();
    },
    testConfig.defaultTimeout
  );

  test(
    'should handle login with invalid credentials',
    async () => {
      const client = createTestClient();
      const deviceContext = generateDeviceContext();

      // Try to login with non-existent user
      await expect(
        client.login('nonexistent@example.com', 'wrongpassword', deviceContext)
      ).rejects.toThrow();
    },
    testConfig.defaultTimeout
  );

  test(
    'should refresh tokens when expired',
    async () => {
      const client = createTestClient();
      const testUser = generateTestUser();
      const deviceContext = generateDeviceContext();

      // Register and get tokens
      const registerResult = await client.register(
        testUser.email,
        testUser.password,
        testUser.name,
        deviceContext
      );

      let tokens = registerResult.tokenData!;
      tokensToCleanup.push({ tokens, deviceContext });

      // Manually refresh tokens
      const newTokens = await client.refreshTokens(tokens.refreshToken, deviceContext);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.accessToken).toBeTruthy();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.expiresAt).toBeDefined();

      // New tokens should work
      const { data: profile } = await client.getProfileWithRefresh(newTokens, deviceContext);
      expect(profile.email).toBe(testUser.email.toLowerCase());

      // Cleanup with new tokens
      await client.logout(newTokens.accessToken, deviceContext);
    },
    testConfig.defaultTimeout
  );

  test(
    'should auto-refresh tokens with WithRefresh methods',
    async () => {
      const client = createTestClient();
      const testUser = generateTestUser();
      const deviceContext = generateDeviceContext();

      // Register user
      const registerResult = await client.register(
        testUser.email,
        testUser.password,
        testUser.name,
        deviceContext
      );

      let tokens = registerResult.tokenData!;
      tokensToCleanup.push({ tokens, deviceContext });

      // Use WithRefresh method multiple times - should handle refresh automatically
      for (let i = 0; i < 3; i++) {
        const { data: profile, tokens: newTokens } = await client.getProfileWithRefresh(
          tokens,
          deviceContext
        );

        expect(profile.email).toBe(testUser.email.toLowerCase());
        expect(newTokens.accessToken).toBeDefined();

        tokens = newTokens; // Update tokens for next iteration
      }

      // Cleanup
      await client.logout(tokens.accessToken, deviceContext);
    },
    testConfig.defaultTimeout
  );

  test(
    'should handle concurrent requests with same tokens',
    async () => {
      const client = createTestClient();
      const testUser = generateTestUser();
      const deviceContext = generateDeviceContext();

      // Register user
      const registerResult = await client.register(
        testUser.email,
        testUser.password,
        testUser.name,
        deviceContext
      );

      const tokens = registerResult.tokenData!;
      tokensToCleanup.push({ tokens, deviceContext });

      // Make multiple concurrent requests
      const results = await Promise.all([
        client.getProfileWithRefresh(tokens, deviceContext),
        client.getProfileWithRefresh(tokens, deviceContext),
        client.getProfileWithRefresh(tokens, deviceContext),
      ]);

      // All should succeed
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.data.email).toBe(testUser.email.toLowerCase());
        expect(result.tokens.accessToken).toBeDefined();
      });

      // Cleanup
      await client.logout(tokens.accessToken, deviceContext);
    },
    testConfig.defaultTimeout
  );

  test(
    'should update user profile',
    async () => {
      const client = createTestClient();
      const testUser = generateTestUser();
      const deviceContext = generateDeviceContext();

      // Register user
      const registerResult = await client.register(
        testUser.email,
        testUser.password,
        testUser.name,
        deviceContext
      );

      let tokens = registerResult.tokenData!;
      tokensToCleanup.push({ tokens, deviceContext });

      // Update profile
      const newName = 'Updated Name';
      const { data: updateResult, tokens: newTokens } = await client.updateProfileWithRefresh(
        tokens,
        { name: newName },
        deviceContext
      );

      expect(updateResult.name).toBe(newName);
      tokens = newTokens;

      // Verify update by getting profile again
      const { data: profile } = await client.getProfileWithRefresh(tokens, deviceContext);
      expect(profile.name).toBe(newName);

      // Cleanup
      await client.logout(tokens.accessToken, deviceContext);
    },
    testConfig.defaultTimeout
  );
});
