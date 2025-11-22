import { JWTVerifier } from './jwt-verifier';
import type { AuthMiddlewareConfig, JWTClaims } from './types';
import { AuthError, AuthErrorType } from './types';

/**
 * Core authentication middleware
 * Provides framework-agnostic JWT validation logic
 */
export class AuthMiddleware {
  private verifier: JWTVerifier;
  private config: AuthMiddlewareConfig;

  constructor(config: AuthMiddlewareConfig) {
    this.config = {
      jwksCacheTTL: 3600000, // 1 hour default
      cookieAuth: true,
      cookieName: 'access_token',
      ...config,
    };
    this.verifier = new JWTVerifier(this.config);
  }

  /**
   * Extract and verify JWT token from request headers/cookies
   * This is the core validation logic used by all framework adapters
   */
  async validateToken(
    authHeader: string | null | undefined,
    cookieHeader: string | undefined
  ): Promise<{
    claims: JWTClaims;
    token: string;
  }> {
    // Try to extract token from Authorization header first
    let token = JWTVerifier.extractFromHeader(authHeader);

    // If not found and cookie auth is enabled, try cookie
    if (!token && this.config.cookieAuth && this.config.cookieName) {
      token = JWTVerifier.extractFromCookie(cookieHeader, this.config.cookieName);
    }

    // No token found
    if (!token) {
      throw new AuthError(
        AuthErrorType.TOKEN_NOT_FOUND,
        'No authentication token found in request'
      );
    }

    // Verify and parse the token
    const claims = await this.verifier.verify(token);

    return { claims, token };
  }

  /**
   * Create Express/Connect middleware
   * @example
   * ```ts
   * const auth = new AuthMiddleware(config);
   * app.get('/protected', auth.express(), (req, res) => {
   *   console.log(req.ssoUser.user_id);
   * });
   * ```
   */
  express() {
    return async (
      req: {
        headers: Record<string, string | string[] | undefined>;
        ssoUser?: JWTClaims;
        ssoToken?: string;
      },
      res: {
        status: (code: number) => {
          json: (body: { error: string }) => void;
        };
      },
      next: (error?: Error) => void
    ) => {
      try {
        const authHeader = req.headers.authorization as string | undefined;
        const cookieHeader = req.headers.cookie as string | undefined;

        const { claims, token } = await this.validateToken(authHeader, cookieHeader);

        // Attach to request
        req.ssoUser = claims;
        req.ssoToken = token;

        next();
      } catch (error) {
        if (error instanceof AuthError) {
          return res.status(error.statusCode).json({ error: error.message });
        }
        next(error instanceof Error ? error : new Error('Unknown error'));
      }
    };
  }

  /**
   * Create Fastify hook/middleware
   * @example
   * ```ts
   * const auth = new AuthMiddleware(config);
   * fastify.addHook('preHandler', auth.fastify());
   * ```
   */
  fastify() {
    return async (
      request: {
        headers: Record<string, string | string[] | undefined>;
        ssoUser?: JWTClaims;
        ssoToken?: string;
      },
      reply: {
        code: (statusCode: number) => {
          send: (payload: { error: string }) => void;
        };
      }
    ) => {
      try {
        const authHeader = request.headers.authorization as string | undefined;
        const cookieHeader = request.headers.cookie as string | undefined;

        const { claims, token } = await this.validateToken(authHeader, cookieHeader);

        // Attach to request
        request.ssoUser = claims;
        request.ssoToken = token;
      } catch (error) {
        if (error instanceof AuthError) {
          reply.code(error.statusCode).send({ error: error.message });
          return;
        }
        throw error;
      }
    };
  }

  /**
   * Create Hono middleware
   * @example
   * ```ts
   * const auth = new AuthMiddleware(config);
   * app.use('/protected/*', auth.hono());
   * ```
   */
  hono() {
    return async (
      c: {
        req: {
          header: (name: string) => string | undefined;
        };
        set: (key: string, value: unknown) => void;
        json: (object: { error: string }, status: number) => Response;
      },
      next: () => Promise<void>
    ) => {
      try {
        const authHeader = c.req.header('authorization');
        const cookieHeader = c.req.header('cookie');

        const { claims, token } = await this.validateToken(authHeader, cookieHeader);

        // Attach to context
        c.set('ssoUser', claims);
        c.set('ssoToken', token);

        await next();
      } catch (error) {
        if (error instanceof AuthError) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    };
  }
}
