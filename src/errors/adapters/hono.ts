import type { Context } from 'hono';
import { mapSSOErrorToHttp } from '../http-mapper.js';

/**
 * Hono adapter for SSO errors
 * Convenience helper that automatically handles errors in Hono controllers
 *
 * @param error - Error from SSO SDK
 * @param c - Hono context
 * @returns Hono JSON response with appropriate status code
 *
 * @example
 * ```typescript
 * import { handleSSOError } from '@rshelekhov/sso-sdk/adapters/hono';
 *
 * // In your Hono controller
 * try {
 *   await ssoClient.register(email, password, name, deviceContext);
 * } catch (error) {
 *   return handleSSOError(error, c);
 * }
 * ```
 */
export function handleSSOError(error: unknown, c: Context) {
  const httpError = mapSSOErrorToHttp(error);

  return c.json(
    {
      error: httpError.message,
      code: httpError.code,
      details: httpError.details,
    },
    httpError.statusCode
  );
}
