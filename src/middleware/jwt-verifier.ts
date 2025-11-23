import * as crypto from 'node:crypto';

import type { AuthMiddlewareConfig, JWK, JWTClaims } from './types';
import { AuthError, AuthErrorType } from './types';

/**
 * JWT Verifier
 * Verifies JWT tokens using JWKS from the SSO server
 */
export class JWTVerifier {
  private config: AuthMiddlewareConfig;
  private jwksCache: JWK[] | null = null;
  private jwksCacheExpiry = 0;

  constructor(config: AuthMiddlewareConfig) {
    this.config = config;
  }

  /**
   * Fetch JWKS from the SSO server
   */
  private async fetchJWKS(): Promise<JWK[]> {
    const now = Date.now();

    if (this.jwksCache && now < this.jwksCacheExpiry) {
      return this.jwksCache;
    }

    try {
      const response = await fetch(this.config.jwksUrl, {
        headers: {
          'X-Client-Id': this.config.clientId,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new AuthError(
          AuthErrorType.JWKS_FETCH_FAILED,
          `Failed to fetch JWKS: ${response.statusText}`
        );
      }

      const data = await response.json();
      const keys = data.keys || data.jwks || [];

      if (!Array.isArray(keys) || keys.length === 0) {
        throw new AuthError(AuthErrorType.JWKS_FETCH_FAILED, 'Invalid JWKS format: no keys found');
      }

      this.jwksCache = keys;
      this.jwksCacheExpiry = now + (this.config.jwksCacheTTL || 3600000);

      return keys;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(
        AuthErrorType.JWKS_FETCH_FAILED,
        `Failed to fetch JWKS: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert JWK to crypto.KeyObject for verification
   */
  private jwkToKey(jwk: JWK): crypto.KeyObject {
    return crypto.createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
      },
      format: 'jwk',
    });
  }

  /**
   * Verify and parse a JWT token
   */
  async verify(token: string): Promise<JWTClaims> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new AuthError(AuthErrorType.TOKEN_MALFORMED, 'Invalid JWT format');
      }

      const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

      // Decode header
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
      if (header.alg !== 'RS256') {
        throw new AuthError(AuthErrorType.TOKEN_INVALID, `Unsupported algorithm: ${header.alg}`);
      }

      // Decode payload
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      // Check expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        throw new AuthError(AuthErrorType.TOKEN_EXPIRED, 'Token has expired');
      }

      // Check issuer
      if (this.config.issuer && payload.iss !== this.config.issuer) {
        throw new AuthError(
          AuthErrorType.CLAIMS_INVALID,
          `Invalid issuer. Expected: ${this.config.issuer}, got: ${payload.iss}`
        );
      }

      // Check audience (supports both 'aud' and 'client_id')
      const tokenAudience = payload.aud || payload.client_id;
      if (this.config.audience && tokenAudience) {
        const audiences = Array.isArray(tokenAudience) ? tokenAudience : [tokenAudience];
        if (!audiences.includes(this.config.audience)) {
          throw new AuthError(
            AuthErrorType.CLAIMS_INVALID,
            `Invalid audience. Expected: ${this.config.audience}`
          );
        }
      }

      // Fetch JWKS and find matching key
      const keys = await this.fetchJWKS();
      const kid = header.kid;
      const jwk = kid ? keys.find((k) => k.kid === kid) : keys[0];

      if (!jwk) {
        throw new AuthError(AuthErrorType.KEY_NOT_FOUND, `Key not found: ${kid}`);
      }

      // Verify signature
      const key = this.jwkToKey(jwk);
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${headerB64}.${payloadB64}`);

      const signature = Buffer.from(signatureB64, 'base64url');
      if (!verifier.verify(key, signature)) {
        throw new AuthError(AuthErrorType.SIGNATURE_INVALID, 'Invalid token signature');
      }

      // Build claims
      return this.payloadToClaims(payload);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(
        AuthErrorType.TOKEN_INVALID,
        `Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert payload to JWTClaims type
   */
  private payloadToClaims(payload: Record<string, unknown>): JWTClaims {
    const user_id = (payload.user_id || payload.sub) as string;
    if (!user_id) {
      throw new AuthError(AuthErrorType.CLAIMS_INVALID, 'Missing required claim: user_id');
    }

    return {
      sub: (payload.sub as string) || user_id,
      iss: payload.iss as string,
      aud: payload.aud as string | string[],
      exp: payload.exp as number,
      iat: payload.iat as number,
      nbf: payload.nbf as number | undefined,
      user_id,
      email: payload.email as string | undefined,
      client_id: payload.client_id as string | undefined,
      device_id: payload.device_id as string | undefined,
      roles: payload.roles as string[] | undefined,
      ...payload,
    };
  }

  /**
   * Extract token from Authorization header
   */
  static extractFromHeader(authHeader: string | null | undefined): string | null {
    if (!authHeader) {
      return null;
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
      return null;
    }
    return parts[1] || null;
  }

  /**
   * Extract token from cookie
   */
  static extractFromCookie(cookies: string | undefined, cookieName: string): string | null {
    if (!cookies) {
      return null;
    }
    for (const cookie of cookies.split(';')) {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name === cookieName) {
        return valueParts.join('=') || null;
      }
    }
    return null;
  }
}
