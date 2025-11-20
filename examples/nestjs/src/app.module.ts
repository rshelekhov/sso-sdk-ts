import { Module } from '@nestjs/common';
import { SSOModule } from './sso/sso.module';
import { AuthController } from './auth/auth.controller';

@Module({
  imports: [SSOModule],
  controllers: [AuthController],
})
export class AppModule {}
