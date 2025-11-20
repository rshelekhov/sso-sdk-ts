import { Controller, Post, Get, Body, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { SSOService } from '../sso/sso.service';

@Controller()
export class AuthController {
  constructor(private ssoService: SSOService) {}

  @Post('login')
  async login(@Body() body: any, @Req() req: Request) {
    try {
      const { email, password } = body;
      const deviceContext = this.ssoService.getDeviceContext(req);
      const tokens = await this.ssoService.getClient().login(email, password, deviceContext);
      
      // Tokens are automatically stored in session by the interceptor
      // because the client instance is updated with the new tokens
      
      return { message: 'Logged in successfully' };
    } catch (error: any) {
      throw new UnauthorizedException(error.message);
    }
  }

  @Post('register')
  async register(@Body() body: any, @Req() req: Request) {
    try {
      const { email, password, name } = body;
      const deviceContext = this.ssoService.getDeviceContext(req);
      return await this.ssoService.getClient().register(email, password, name, deviceContext);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    try {
      const deviceContext = this.ssoService.getDeviceContext(req);
      await this.ssoService.getClient().logout(deviceContext);
      return { message: 'Logged out successfully' };
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('profile')
  async getProfile(@Req() req: Request) {
    const client = this.ssoService.getClient();
    if (!client.isAuthenticated()) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const deviceContext = this.ssoService.getDeviceContext(req);
      return await client.getProfile(deviceContext);
    } catch (error: any) {
      throw new UnauthorizedException(error.message);
    }
  }
}
