import type { APIErrorResponse } from '../types/index.js';
import { API_ERROR_CODES } from '../types/index.js';

/**
 * Base error class for all SDK errors
 * Extends the built-in Error class
 */
export class SSOError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SSOError';

    Object.setPrototypeOf(this, SSOError.prototype);
  }
}

/**
 * Validation error (400 Bad Request)
 * Thrown when request data is invalid
 */
export class ValidationError extends SSOError {
  public fields: Record<string, string[]>;

  constructor(message: string, fields: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR', 400, fields);
    this.name = 'ValidationError';
    this.fields = fields;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  /**
   * Get errors for a specific field
   * @example
   * if (error.hasFieldError('email')) {
   *   console.log(error.getFieldErrors('email')); // ["Email is required"]
   * }
   */
  getFieldErrors(field: string): string[] {
    return this.fields[field] || [];
  }

  hasFieldError(field: string): boolean {
    return field in this.fields;
  }
}

/**
 * Authentication error (401 Unauthorized)
 * Thrown when credentials are invalid or token is expired
 */
export class AuthenticationError extends SSOError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Not found error (404 Not Found)
 * Thrown when a resource doesn't exist
 */
export class NotFoundError extends SSOError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict error (409 Conflict)
 * Thrown when a resource already exists (e.g., email already registered)
 */
export class ConflictError extends SSOError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Parse API error response and create appropriate error instance
 * Maps SSO API error codes to specific error classes for better error handling
 * @param statusCode HTTP status code from the API response
 * @param errorBody Error response body from the SSO API
 * @returns Specific error instance (ValidationError, AuthenticationError, NotFoundError, ConflictError, or generic SSOError)
 * @example
 * try {
 *   const response = await fetch('/api/login', { method: 'POST', body: JSON.stringify(credentials) });
 *   if (!response.ok) {
 *     const errorBody = await response.json();
 *     throw parseAPIError(response.status, errorBody);
 *   }
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.log('Validation failed:', error.fields);
 *   } else if (error instanceof AuthenticationError) {
 *     console.log('Authentication failed:', error.message);
 *   } else if (error instanceof NotFoundError) {
 *     console.log('Resource not found:', error.message);
 *   } else if (error instanceof ConflictError) {
 *     console.log('Conflict:', error.message);
 *   } else {
 *     // Generic SSOError for any unmapped error codes
 *     console.log('SSO error:', error.code, error.message);
 *   }
 * }
 */
export function parseAPIError(statusCode: number, errorBody: APIErrorResponse): SSOError {
  const { code, message, details } = errorBody;
  const safeDetails: Record<string, string[]> = details ?? {};

  switch (code) {
    case API_ERROR_CODES.VALIDATION_ERROR:
      return new ValidationError(message, safeDetails);

    case API_ERROR_CODES.INVALID_CREDENTIALS:
    case API_ERROR_CODES.SESSION_EXPIRED:
    case API_ERROR_CODES.SESSION_NOT_FOUND:
      return new AuthenticationError(message, safeDetails);

    case API_ERROR_CODES.USER_NOT_FOUND:
    case API_ERROR_CODES.VERIFICATION_TOKEN_NOT_FOUND:
      return new NotFoundError(message, safeDetails);

    case API_ERROR_CODES.USER_ALREADY_EXISTS:
    case API_ERROR_CODES.EMAIL_ALREADY_TAKEN:
    case API_ERROR_CODES.CLIENT_ALREADY_EXISTS:
      return new ConflictError(message, safeDetails);

    default:
      return new SSOError(message, code, statusCode, safeDetails);
  }
}
