import { Injectable, Scope } from '@nestjs/common';
import { SSOClient, SSOClientConfig, Platform, TokenData, DeviceContext } from '@rshelekhov/sso-sdk';

@Injectable({ scope: Scope.REQUEST })
export class SSOService {
  private client: SSOClient;

  constructor() {
    // In a real app, config should come from ConfigService
    const config: SSOClientConfig = {
      baseUrl: process.env.SSO_API_URL || 'http://localhost:8080',
      clientId: process.env.SSO_CLIENT_ID || 'nestjs-example',
      publicUrls: {
        emailVerification: 'http://localhost:3000/verify-email',
        passwordReset: 'http://localhost:3000/reset-password'
      }
    };
    this.client = new SSOClient(config);
  }

  getClient(): SSOClient {
    return this.client;
  }

  // Helper to extract device context from request
  getDeviceContext(req: any): DeviceContext {
    return {
      platform: Platform.WEB,
      clientIP: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'unknown'
    };
  }
}
