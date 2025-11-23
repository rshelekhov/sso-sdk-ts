import { JWTVerifier } from './jwt-verifier';
import type { AuthMiddlewareConfig, JWTClaims } from './types';
import { AuthError } from './types';

/**
 * NestJS Guard for JWT authentication
 *
 * @example
 * ```ts
 * // In your auth module
 * import { SSOAuthGuard } from '@rshelekhov/sso-sdk';
 *
 * @Module({
 *   providers: [
 *     {
 *       provide: 'SSO_AUTH_GUARD',
 *       useFactory: () => {
 *         return new SSOAuthGuard({
 *           jwksUrl: 'https://sso.example.com/v1/auth/.well-known/jwks.json',
 *           issuer: 'https://sso.example.com',
 *           audience: 'my-api-service',
 *         });
 *       },
 *     },
 *   ],
 *   exports: ['SSO_AUTH_GUARD'],
 * })
 * export class AuthModule {}
 *
 * // In your controller
 * @Controller('api')
 * export class ApiController {
 *   @Get('profile')
 *   @UseGuards(Inject('SSO_AUTH_GUARD'))
 *   getProfile(@Req() req: RequestWithSSO) {
 *     return { userId: req.ssoUser.user_id };
 *   }
 * }
 * ```
 */
export class SSOAuthGuard {
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
   * Validate request and attach claims
   * Compatible with NestJS CanActivate interface
   */
  async canActivate(context: {
    switchToHttp: () => {
      getRequest: () => {
        headers: Record<string, string | string[] | undefined>;
        ssoUser?: JWTClaims;
        ssoToken?: string;
      };
      getResponse: () => {
        status: (code: number) => {
          json: (body: { error: string }) => void;
        };
      };
    };
  }): Promise<boolean> {
    try {
      const http = context.switchToHttp();
      const request = http.getRequest();

      const authHeader = request.headers.authorization as string | undefined;
      const cookieHeader = request.headers.cookie as string | undefined;

      // Try to extract token from Authorization header first
      let token = JWTVerifier.extractFromHeader(authHeader);

      // If not found and cookie auth is enabled, try cookie
      if (!token && this.config.cookieAuth && this.config.cookieName) {
        token = JWTVerifier.extractFromCookie(cookieHeader, this.config.cookieName);
      }

      // No token found
      if (!token) {
        return false;
      }

      // Verify and parse the token
      const claims = await this.verifier.verify(token);

      // Attach to request
      request.ssoUser = claims;
      request.ssoToken = token;

      return true;
    } catch (error) {
      // Let NestJS handle the error
      if (error instanceof AuthError) {
        return false;
      }
      throw error;
    }
  }
}

/**
 * Extended Request type for NestJS with SSO claims
 */
export interface RequestWithSSO {
  ssoUser: JWTClaims;
  ssoToken: string;
}
