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
 * Numeric error codes returned by the SSO API
 * These match the ErrorCode enum from the backend protobuf definitions
 */
export const API_ERROR_CODES = {
  // Authentication Errors (1000-1099)
  INVALID_CREDENTIALS: 1000,
  USER_ALREADY_EXISTS: 1001,
  USER_NOT_FOUND: 1002,
  SESSION_EXPIRED: 1003,
  SESSION_NOT_FOUND: 1004,
  EMAIL_ALREADY_TAKEN: 1005,
  USER_DEVICE_NOT_FOUND: 1006,

  // Verification Errors (1100-1199)
  TOKEN_EXPIRED: 1100,
  VERIFICATION_TOKEN_NOT_FOUND: 1101,
  TOKEN_EXPIRED_EMAIL_RESENT: 1102,

  // Validation Errors (1200-1299)
  PASSWORDS_DO_NOT_MATCH: 1200,
  NO_EMAIL_CHANGES_DETECTED: 1201,
  NO_PASSWORD_CHANGES_DETECTED: 1202,
  NO_NAME_CHANGES_DETECTED: 1203,
  CLIENT_ID_NOT_ALLOWED: 1204,
  VALIDATION_ERROR: 1205,
  CURRENT_PASSWORD_REQUIRED: 1206,

  // Client Management Errors (1300-1399)
  CLIENT_NOT_FOUND: 1300,
  CLIENT_ALREADY_EXISTS: 1301,
  CLIENT_NAME_EMPTY: 1302,

  // Internal Service Errors (1500-1599)
  FAILED_TO_SEND_VERIFICATION_EMAIL: 1500,
  FAILED_TO_SEND_RESET_PASSWORD_EMAIL: 1501,
} as const;

/**
 * Union type of all possible API error codes
 */
export type APIErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * API error response structure
 */
export interface APIErrorResponse {
  code: number; // Numeric error code (1000-1599)
  message: string; // Human-readable error message
  details?: Record<string, string[]>; // Field-specific errors for validation
}
