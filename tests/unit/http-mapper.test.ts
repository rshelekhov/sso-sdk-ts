/**
 * Unit tests for HTTP error mapping utilities
 */
import { describe, expect, test } from 'bun:test';

import {
  AuthenticationError,
  ConflictError,
  getUserFriendlyMessage,
  mapSSOErrorToHttp,
  NotFoundError,
  SSOError,
  ValidationError,
} from '../../src/errors';

describe('mapSSOErrorToHttp', () => {
  test('should preserve ValidationError fields in details', () => {
    const fields = {
      email: ['Invalid email format'],
      password: ['Password too short', 'Must contain numbers'],
    };
    const error = new ValidationError('Validation failed', fields);

    const result = mapSSOErrorToHttp(error);

    expect(result.statusCode).toBe(400);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.details).toEqual(fields);
  });

  test('should preserve specific error codes from API', () => {
    const error = new AuthenticationError('Invalid credentials', 'ERROR_CODE_INVALID_CREDENTIALS');

    const result = mapSSOErrorToHttp(error);

    // Critical: specific code should be preserved, not replaced with 'AUTHENTICATION_ERROR'
    expect(result.statusCode).toBe(401);
    expect(result.code).toBe('ERROR_CODE_INVALID_CREDENTIALS');
    expect(result.message).toBe('Invalid email or password');
  });

  test('should map each error class to correct status code', () => {
    expect(mapSSOErrorToHttp(new ValidationError('msg', {})).statusCode).toBe(400);
    expect(mapSSOErrorToHttp(new AuthenticationError('msg')).statusCode).toBe(401);
    expect(mapSSOErrorToHttp(new NotFoundError('msg')).statusCode).toBe(404);
    expect(mapSSOErrorToHttp(new ConflictError('msg')).statusCode).toBe(409);
  });

  test('should fallback to 500 for invalid status codes', () => {
    const error = new SSOError('Teapot', 'ERROR_CODE_TEAPOT', 418);

    const result = mapSSOErrorToHttp(error);

    expect(result.statusCode).toBe(500);
    expect(result.code).toBe('ERROR_CODE_TEAPOT');
  });

  test('should detect network errors and return 503', () => {
    const errors = [
      new Error('connect ECONNREFUSED 127.0.0.1:8080'),
      new Error('Unable to connect to server'),
      new Error('fetch failed'),
    ];

    for (const error of errors) {
      const result = mapSSOErrorToHttp(error);
      expect(result.statusCode).toBe(503);
      expect(result.message).toBe('Service temporarily unavailable');
    }
  });

  test('should return 500 for unknown error types', () => {
    const result = mapSSOErrorToHttp(new Error('Something went wrong'));

    expect(result.statusCode).toBe(500);
    expect(result.message).toBe('Internal server error');
    expect(result.code).toBeUndefined();
  });
});

describe('getUserFriendlyMessage', () => {
  test('should map all documented error codes correctly', () => {
    const testCases = [
      {
        code: 'ERROR_CODE_INVALID_CREDENTIALS',
        expected: 'Invalid email or password',
      },
      {
        code: 'ERROR_CODE_USER_ALREADY_EXISTS',
        expected: 'An account with this email already exists',
      },
      {
        code: 'ERROR_CODE_EMAIL_ALREADY_TAKEN',
        expected: 'This email is already registered',
      },
      {
        code: 'ERROR_CODE_USER_NOT_FOUND',
        expected: 'User not found',
      },
      {
        code: 'ERROR_CODE_SESSION_EXPIRED',
        expected: 'Your session has expired. Please login again',
      },
      {
        code: 'ERROR_CODE_SESSION_NOT_FOUND',
        expected: 'Session not found',
      },
      {
        code: 'ERROR_CODE_VERIFICATION_TOKEN_NOT_FOUND',
        expected: 'Verification link is invalid or expired',
      },
    ];

    for (const { code, expected } of testCases) {
      const message = getUserFriendlyMessage(code, 'Default');
      expect(message).toBe(expected);
    }
  });

  test('should return default message for unknown codes', () => {
    expect(getUserFriendlyMessage('ERROR_CODE_UNKNOWN', 'Default')).toBe('Default');
    expect(getUserFriendlyMessage(undefined, 'Default')).toBe('Default');
    expect(getUserFriendlyMessage('', 'Default')).toBe('Default');
  });
});
