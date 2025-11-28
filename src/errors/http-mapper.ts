import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  type SSOError,
  ValidationError,
} from './index.js';
import { API_ERROR_CODES } from '../types/index.js';

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
 * Maps numeric error codes to human-readable messages
 */
export const USER_FRIENDLY_MESSAGES: Record<number, string> = {
  // Authentication Errors (1000-1099)
  [API_ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid email or password',
  [API_ERROR_CODES.USER_ALREADY_EXISTS]: 'An account with this email already exists',
  [API_ERROR_CODES.USER_NOT_FOUND]: 'User not found',
  [API_ERROR_CODES.SESSION_EXPIRED]: 'Your session has expired. Please login again',
  [API_ERROR_CODES.SESSION_NOT_FOUND]: 'Session not found',
  [API_ERROR_CODES.EMAIL_ALREADY_TAKEN]: 'This email is already registered',
  [API_ERROR_CODES.USER_DEVICE_NOT_FOUND]: 'Device not found',

  // Verification Errors (1100-1199)
  [API_ERROR_CODES.TOKEN_EXPIRED]: 'Token has expired',
  [API_ERROR_CODES.VERIFICATION_TOKEN_NOT_FOUND]: 'Verification link is invalid or expired',
  [API_ERROR_CODES.TOKEN_EXPIRED_EMAIL_RESENT]:
    'Token expired. A new verification email has been sent',

  // Validation Errors (1200-1299)
  [API_ERROR_CODES.PASSWORDS_DO_NOT_MATCH]: 'Passwords do not match',
  [API_ERROR_CODES.NO_EMAIL_CHANGES_DETECTED]: 'No email changes detected',
  [API_ERROR_CODES.NO_PASSWORD_CHANGES_DETECTED]: 'No password changes detected',
  [API_ERROR_CODES.NO_NAME_CHANGES_DETECTED]: 'No name changes detected',
  [API_ERROR_CODES.CLIENT_ID_NOT_ALLOWED]: 'Client ID not allowed',
  [API_ERROR_CODES.VALIDATION_ERROR]: 'Validation error',
  [API_ERROR_CODES.CURRENT_PASSWORD_REQUIRED]: 'Current password is required',

  // Client Management Errors (1300-1399)
  [API_ERROR_CODES.CLIENT_NOT_FOUND]: 'Client not found',
  [API_ERROR_CODES.CLIENT_ALREADY_EXISTS]: 'Client already exists',
  [API_ERROR_CODES.CLIENT_NAME_EMPTY]: 'Client name cannot be empty',

  // Internal Service Errors (1500-1599)
  [API_ERROR_CODES.FAILED_TO_SEND_VERIFICATION_EMAIL]:
    'Failed to send verification email. Please try again',
  [API_ERROR_CODES.FAILED_TO_SEND_RESET_PASSWORD_EMAIL]:
    'Failed to send password reset email. Please try again',
};

/**
 * Get user-friendly error message
 * Falls back to provided message if no mapping exists
 *
 * @param code - Numeric or string error code from SSO
 * @param defaultMessage - Fallback message
 * @returns User-friendly error message
 */
export function getUserFriendlyMessage(
  code: string | number | undefined,
  defaultMessage: string
): string {
  if (code !== undefined) {
    const numericCode = typeof code === 'string' ? Number.parseInt(code, 10) : code;
    if (!Number.isNaN(numericCode) && USER_FRIENDLY_MESSAGES[numericCode]) {
      return USER_FRIENDLY_MESSAGES[numericCode];
    }
  }
  return defaultMessage;
}
