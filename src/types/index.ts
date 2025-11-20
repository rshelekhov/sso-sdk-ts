/**
 * Platform enum - matches SSO API
 */
export enum Platform {
  UNSPECIFIED = 'PLATFORM_UNSPECIFIED',
  WEB = 'PLATFORM_WEB',
  iOS = 'PLATFORM_IOS',
  ANDROID = 'PLATFORM_ANDROID',
}

/**
 * User device information
 * This gets sent with most requests to track where the user is logging in from
 */
export interface UserDeviceData {
  userAgent: string; // e.g., "Mozilla/5.0..."
  ip: string; // e.g., "192.168.1.100"
  platform: Platform; // WEB, IOS, or ANDROID
  appVersion?: string; // Mobile app version (for iOS/Android)
  browserVersion?: string; // Browser version (for web platform)
}

/**
 * Token pair returned from login/register
 */
export interface TokenData {
  accessToken: string; // Short-lived token for API requests
  refreshToken: string; // Long-lived token for getting new access tokens
  expiresAt: string; // When the access token expires (ISO 8601 date)
  domain?: string; // Cookie domain for web clients
  path?: string; // Cookie path for web clients
  httpOnly?: boolean; // Whether cookies should be HTTP-only
  additionalFields?: Record<string, string>; // Extra application-specific data
}

/**
 * User profile data
 */
export interface User {
  id: string;
  email: string;
  name: string;
  verified: boolean; // Has the user verified their email?
  updatedAt: string; // Last update time (ISO 8601 date)
}

/**
 * Public URLs configuration for email links sent to end users
 */
export interface PublicUrls {
  emailVerification: string; // URL for email verification links (e.g., "https://yourapp.com/verify-email")
  passwordReset: string; // URL for password reset page (e.g., "https://yourapp.com/reset-password")
}

/**
 * Configuration options for the SDK
 */
export interface SSOClientConfig {
  baseUrl: string; // SSO service URL for API calls (e.g., "https://sso.internal:44044")
  clientId: string; // Your application's client ID
  publicUrls: PublicUrls; // Public URLs for email links sent to end users
  timeout?: number; // Request timeout in milliseconds (default: 30000)
}

/**
 * Standard error codes returned by the SSO API
 */
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'ERROR_CODE_VALIDATION_ERROR',
  INVALID_CREDENTIALS: 'ERROR_CODE_INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'ERROR_CODE_SESSION_EXPIRED',
  SESSION_NOT_FOUND: 'ERROR_CODE_SESSION_NOT_FOUND',
  USER_NOT_FOUND: 'ERROR_CODE_USER_NOT_FOUND',
  VERIFICATION_TOKEN_NOT_FOUND: 'ERROR_CODE_VERIFICATION_TOKEN_NOT_FOUND',
  USER_ALREADY_EXISTS: 'ERROR_CODE_USER_ALREADY_EXISTS',
  EMAIL_ALREADY_TAKEN: 'ERROR_CODE_EMAIL_ALREADY_TAKEN',
  CLIENT_ALREADY_EXISTS: 'ERROR_CODE_CLIENT_ALREADY_EXISTS',
} as const;

/**
 * Union type of all possible API error codes
 */
export type APIErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * API error response structure
 */
export interface APIErrorResponse {
  code: APIErrorCode; // Error code like "ERROR_CODE_INVALID_CREDENTIALS"
  message: string; // Human-readable error message
  details?: Record<string, string[]>; // Field-specific errors for validation
}
