/**
 * Helper functions for integration tests
 */
import { faker } from '@faker-js/faker';

import { testConfig } from './config';

import { DeviceContext, Platform, SSOClient, TokenData } from '../../src';

/**
 * Generate random test user data
 */
export function generateTestUser() {
  return {
    email: faker.internet.email().toLowerCase(),
    password: generateSecurePassword(),
    name: faker.person.fullName(),
  };
}

/**
 * Generate a password that meets SSO requirements
 * (at least 8 chars, uppercase, lowercase, digit, special char)
 */
export function generateSecurePassword(): string {
  const password = faker.internet.password({
    length: 12,
    memorable: false,
    pattern: /[A-Za-z0-9!@#$%^&*]/,
  });

  // Ensure it has all required character types
  return password + 'Aa1!';
}

/**
 * Generate device context for requests
 */
export function generateDeviceContext(): DeviceContext {
  return {
    platform: Platform.WEB,
    clientIP: faker.internet.ipv4(),
    userAgent: faker.internet.userAgent(),
  };
}

/**
 * Create SSO client configured for tests
 */
export function createTestClient(): SSOClient {
  return new SSOClient({
    baseUrl: testConfig.ssoBaseUrl,
    clientId: testConfig.clientId,
    publicUrls: {
      emailVerification: testConfig.verificationUrl,
      passwordReset: testConfig.passwordResetUrl,
    },
  });
}

/**
 * Wait for SSO server to be ready
 */
export async function waitForServer(maxAttempts = 30, delayMs = 1000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${testConfig.ssoBaseUrl}/v1/auth/.well-known/jwks.json`, {
        headers: {
          'X-Client-Id': testConfig.clientId,
        },
      });
      if (response.ok) {
        console.log('SSO server is ready!');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }

    if (i < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.error('SSO server did not become ready in time');
  return false;
}

/**
 * Cleanup test user by logging out
 * This invalidates the session on the SSO server
 */
export async function cleanupTestUser(
  client: SSOClient,
  tokens: TokenData,
  deviceContext: DeviceContext
): Promise<void> {
  try {
    await client.logout(tokens.accessToken, deviceContext);
  } catch (error) {
    // Ignore cleanup errors - test data will be cleaned up when DB resets
    console.warn('Cleanup warning:', error);
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse JWT token (without verification)
 * Useful for inspecting token claims in tests
 */
export function parseJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error(`Failed to parse JWT: ${error}`);
  }
}

/**
 * Check if JWT is expired
 */
export function isJWTExpired(token: string): boolean {
  try {
    const payload = parseJWT(token);
    if (!payload.exp) {
      return true;
    }

    return Date.now() >= payload.exp * 1000;
  } catch (error) {
    return true;
  }
}
