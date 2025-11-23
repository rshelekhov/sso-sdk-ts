/**
 * JWT Claims structure matching the SSO server's token format
 */
export interface JWTClaims {
  // Standard JWT claims
  sub: string; // Subject (usually user ID)
  iss: string; // Issuer (SSO server URL)
  aud: string | string[]; // Audience (client IDs)
  exp: number; // Expiration time (Unix timestamp)
  iat: number; // Issued at (Unix timestamp)
  nbf?: number; // Not before (Unix timestamp)

  // Custom SSO claims (matching your Go middleware)
  user_id: string;
  email?: string;
  client_id?: string;
  device_id?: string;
  roles?: string[];

  // Allow additional custom claims
  [key: string]: unknown;
}

/**
 * JSON Web Key (JWK) structure from JWKS endpoint
 */
export interface JWK {
  kid: string; // Key ID
  kty: string; // Key type (e.g., "RSA")
  alg: string; // Algorithm (e.g., "RS256")
  use: string; // Key use (e.g., "sig")
  n: string; // RSA modulus (base64url encoded)
  e: string; // RSA exponent (base64url encoded)
}

/**
 * JWKS response from SSO server
 */
export interface JWKS {
  keys: JWK[];
}

/**
 * Configuration for the auth middleware
 */
export interface AuthMiddlewareConfig {
  /**
   * URL to fetch JWKS from your SSO server
   * Example: "https://sso.example.com/v1/auth/.well-known/jwks.json"
   */
  jwksUrl: string;

  /**
   * Expected issuer in JWT tokens (must match "iss" claim)
   * Example: "https://sso.example.com"
   */
  issuer: string;

  /**
   * Expected audience in JWT tokens (must match "aud" claim)
   * This is your application's client ID
   */
  audience: string;

  /**
   * Client ID sent in X-Client-Id header when fetching JWKS
   */
  clientId: string;

  /**
   * JWKS cache TTL in milliseconds
   * Default: 3600000 (1 hour)
   */
  jwksCacheTTL?: number;

  /**
   * Whether to extract token from cookies
   * Default: true
   */
  cookieAuth?: boolean;

  /**
   * Cookie name for access token
   * Default: "access_token"
   */
  cookieName?: string;
}

/**
 * Extended request object with authenticated user claims
 */
export interface AuthenticatedRequest {
  ssoUser?: JWTClaims;
  ssoToken?: string;
}

/**
 * Error types for authentication failures
 */
export enum AuthErrorType {
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_MALFORMED = 'TOKEN_MALFORMED',
  JWKS_FETCH_FAILED = 'JWKS_FETCH_FAILED',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  CLAIMS_INVALID = 'CLAIMS_INVALID',
}

/**
 * Authentication error class
 */
export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
