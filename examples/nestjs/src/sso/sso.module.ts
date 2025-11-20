import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SSOService } from './sso.service';
import { SSOInterceptor } from './sso.interceptor';

@Global()
@Module({
  providers: [
    SSOService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SSOInterceptor,
    },
  ],
  exports: [SSOService],
})
export class SSOModule {}
