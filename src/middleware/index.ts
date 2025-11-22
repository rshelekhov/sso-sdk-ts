/**
 * Authentication Middleware Module
 *
 * Provides JWT authentication middleware for popular Node.js frameworks.
 * Validates tokens issued by your SSO server using JWKS.
 */

export { AuthMiddleware } from './auth-middleware';
export { JWKSFetcher } from './jwks-fetcher';
export { JWTVerifier } from './jwt-verifier';
export { type RequestWithSSO, SSOAuthGuard } from './nestjs-guard';
export {
  AuthError,
  AuthErrorType,
  type AuthenticatedRequest,
  type AuthMiddlewareConfig,
  type JWK,
  type JWKS,
  type JWTClaims,
} from './types';
