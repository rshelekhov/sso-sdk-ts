/**
 * Unit tests for token utilities
 */
import { describe, expect, test } from 'bun:test';

import { SSOClient } from '../../src';

describe('Token Utilities', () => {
  // Create a test client for accessing utility methods
  const client = new SSOClient({
    baseUrl: 'http://localhost:8080',
    clientId: 'test-client',
    publicUrls: {
      emailVerification: 'http://test.com/verify',
      passwordReset: 'http://test.com/reset',
    },
  });

  describe('isTokenExpired', () => {
    test('should return true for expired token', () => {
      // Token that expired 1 second ago
      const pastDate = new Date(Date.now() - 1000).toISOString();
      expect(client.isTokenExpired(pastDate)).toBe(true);
    });

    test('should return true for token that expired 1 hour ago', () => {
      const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
      expect(client.isTokenExpired(pastDate)).toBe(true);
    });

    test('should return false for token with more than 60s remaining (default buffer)', () => {
      // Token that expires in 2 minutes (120 seconds)
      // Default buffer is 60 seconds, so this should not be expired
      const futureDate = new Date(Date.now() + 120000).toISOString();
      expect(client.isTokenExpired(futureDate)).toBe(false);
    });

    test('should return true for token expiring within buffer time', () => {
      // Token that expires in 30 seconds
      // Default buffer is 60 seconds, so this should be considered expired
      const futureDate = new Date(Date.now() + 30000).toISOString();
      expect(client.isTokenExpired(futureDate)).toBe(true);
    });

    test('should return false for token that expires in 1 hour', () => {
      const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
      expect(client.isTokenExpired(futureDate)).toBe(false);
    });

    test('should return true for token expiring right now', () => {
      const now = new Date().toISOString();
      expect(client.isTokenExpired(now)).toBe(true);
    });

    test('should handle timezone differences correctly', () => {
      // Token expiring in 5 minutes (300 seconds)
      const utcDate = new Date(Date.now() + 300000).toISOString();
      expect(client.isTokenExpired(utcDate)).toBe(false);
    });
  });

  describe('SSOClient constructor', () => {
    test('should create client with valid config', () => {
      const testClient = new SSOClient({
        baseUrl: 'https://api.example.com',
        clientId: 'my-client-id',
        publicUrls: {
          emailVerification: 'https://example.com/verify',
          passwordReset: 'https://example.com/reset',
        },
      });

      expect(testClient).toBeDefined();
    });

    test('should handle baseUrl without trailing slash', () => {
      const testClient = new SSOClient({
        baseUrl: 'https://api.example.com',
        clientId: 'my-client-id',
        publicUrls: {
          emailVerification: 'https://example.com/verify',
          passwordReset: 'https://example.com/reset',
        },
      });

      expect(testClient).toBeDefined();
    });

    test('should handle baseUrl with trailing slash', () => {
      const testClient = new SSOClient({
        baseUrl: 'https://api.example.com/',
        clientId: 'my-client-id',
        publicUrls: {
          emailVerification: 'https://example.com/verify',
          passwordReset: 'https://example.com/reset',
        },
      });

      expect(testClient).toBeDefined();
    });
  });
});
