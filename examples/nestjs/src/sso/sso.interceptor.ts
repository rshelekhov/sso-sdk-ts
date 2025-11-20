import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SSOService } from './sso.service';

@Injectable()
export class SSOInterceptor implements NestInterceptor {
  constructor(private ssoService: SSOService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const client = this.ssoService.getClient();

    // Restore tokens from session
    if (req.session && req.session.tokens) {
      client.setTokens(req.session.tokens);
    }

    return next.handle().pipe(
      tap(() => {
        // Persist tokens (handle refresh)
        const tokens = client.getTokens();
        if (req.session) {
          if (tokens) {
            req.session.tokens = tokens;
          } else if (req.session.tokens && !tokens) {
            // Tokens were cleared (logout)
            delete req.session.tokens;
          }
        }
      }),
    );
  }
}
