import type { JWK, JWKS } from './types';
import { AuthError, AuthErrorType } from './types';

/**
 * Cache entry for JWKS with expiration
 */
interface CacheEntry {
  jwks: JWKS;
  expiresAt: number;
}

/**
 * JWKS fetcher with caching
 * Fetches and caches JSON Web Key Sets from the SSO server
 */
export class JWKSFetcher {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTTL: number;

  constructor(cacheTTL: number = 3600000) {
    // Default: 1 hour
    this.cacheTTL = cacheTTL;
  }

  /**
   * Get JWKS from cache or fetch from server
   */
  async getJWKS(jwksUrl: string): Promise<JWKS> {
    // Check cache first
    const cached = this.cache.get(jwksUrl);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.jwks;
    }

    // Fetch from server
    try {
      const response = await fetch(jwksUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new AuthError(
          AuthErrorType.JWKS_FETCH_FAILED,
          `Failed to fetch JWKS: ${response.statusText}`,
          response.status
        );
      }

      const jwks = (await response.json()) as JWKS;

      // Validate JWKS structure
      if (!jwks.keys || !Array.isArray(jwks.keys)) {
        throw new AuthError(
          AuthErrorType.JWKS_FETCH_FAILED,
          'Invalid JWKS format: missing or invalid keys array'
        );
      }

      // Cache the result
      this.cache.set(jwksUrl, {
        jwks,
        expiresAt: Date.now() + this.cacheTTL,
      });

      return jwks;
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
   * Get a specific JWK by kid (Key ID)
   */
  async getJWK(jwksUrl: string, kid: string): Promise<JWK> {
    const jwks = await this.getJWKS(jwksUrl);

    const jwk = jwks.keys.find((key) => key.kid === kid);
    if (!jwk) {
      throw new AuthError(AuthErrorType.KEY_NOT_FOUND, `JWK with kid "${kid}" not found in JWKS`);
    }

    return jwk;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [url, entry] of Array.from(this.cache.entries())) {
      if (now >= entry.expiresAt) {
        this.cache.delete(url);
      }
    }
  }
}
