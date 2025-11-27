import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  type SSOError,
  ValidationError,
} from './index.js';

/**
 * Valid HTTP error status codes
 */
export type HttpErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 500 | 503;

/**
 * HTTP Error Response Structure
 */
export interface HttpErrorResponse {
  message: string;
  code?: string;
  details?: unknown;
  statusCode: HttpErrorStatusCode;
}

/**
 * Map SSO errors to HTTP responses
 *
 * @param error - Error from SSO SDK or any Error
 * @returns HttpErrorResponse with appropriate status code and message
 *
 * @example
 * ```typescript
 * import { mapSSOErrorToHttp } from '@rshelekhov/sso-sdk';
 *
 * try {
 *   await ssoClient.register(email, password, name, deviceContext);
 * } catch (error) {
 *   const httpError = mapSSOErrorToHttp(error);
 *   // Use httpError.statusCode, httpError.message in your framework
 *   return res.status(httpError.statusCode).json({
 *     error: httpError.message,
 *     code: httpError.code,
 *     details: httpError.details
 *   });
 * }
 * ```
 */
export function mapSSOErrorToHttp(error: unknown): HttpErrorResponse {
  // ValidationError (400) - Field-level validation errors
  if (error instanceof ValidationError) {
    return {
      message: error.message || 'Validation failed',
      code: error.code,
      details: error.fields, // { email: ["Invalid format"], password: ["Too short"] }
      statusCode: 400,
    };
  }

  // AuthenticationError (401) - Invalid credentials, expired tokens
  if (error instanceof AuthenticationError) {
    return {
      message: getUserFriendlyMessage(error.code, error.message || 'Authentication failed'),
      code: error.code,
      statusCode: 401,
    };
  }

  // NotFoundError (404) - User not found, token not found
  if (error instanceof NotFoundError) {
    return {
      message: getUserFriendlyMessage(error.code, error.message || 'Resource not found'),
      code: error.code,
      statusCode: 404,
    };
  }

  // ConflictError (409) - User already exists, email taken
  if (error instanceof ConflictError) {
    return {
      message: getUserFriendlyMessage(error.code, error.message || 'Resource already exists'),
      code: error.code,
      statusCode: 409,
    };
  }

  // Generic SSOError - Fallback for unmapped SSO errors
  if (isSSOError(error)) {
    return {
      message: error.message || 'An error occurred',
      code: error.code,
      statusCode: isValidStatusCode(error.statusCode) ? error.statusCode : 500,
    };
  }

  // Network errors, connection failures
  if (error instanceof Error) {
    if (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('Unable to connect') ||
      error.message.includes('fetch failed')
    ) {
      return {
        message: 'Service temporarily unavailable',
        statusCode: 503,
      };
    }
  }

  // Unknown errors - Don't leak internal details
  return {
    message: 'Internal server error',
    statusCode: 500,
  };
}

/**
 * Type guard to check if error is an SSOError
 */
function isSSOError(error: unknown): error is SSOError {
  return error instanceof Error && 'code' in error && typeof (error as SSOError).code === 'string';
}

/**
 * Type guard to check if status code is valid
 */
function isValidStatusCode(code: number | undefined): code is HttpErrorStatusCode {
  return code !== undefined && [400, 401, 403, 404, 409, 500, 503].includes(code);
}

/**
 * User-friendly error messages
 * Maps technical error codes to human-readable messages
 */
export const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  ERROR_CODE_INVALID_CREDENTIALS: 'Invalid email or password',
  ERROR_CODE_USER_ALREADY_EXISTS: 'An account with this email already exists',
  ERROR_CODE_EMAIL_ALREADY_TAKEN: 'This email is already registered',
  ERROR_CODE_USER_NOT_FOUND: 'User not found',
  ERROR_CODE_SESSION_EXPIRED: 'Your session has expired. Please login again',
  ERROR_CODE_SESSION_NOT_FOUND: 'Session not found',
  ERROR_CODE_VERIFICATION_TOKEN_NOT_FOUND: 'Verification link is invalid or expired',
};

/**
 * Get user-friendly error message
 * Falls back to provided message if no mapping exists
 *
 * @param code - Error code from SSO
 * @param defaultMessage - Fallback message
 * @returns User-friendly error message
 */
export function getUserFriendlyMessage(code: string | undefined, defaultMessage: string): string {
  if (code && USER_FRIENDLY_MESSAGES[code]) {
    return USER_FRIENDLY_MESSAGES[code];
  }
  return defaultMessage;
}
