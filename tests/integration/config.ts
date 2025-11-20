/**
 * Configuration for integration tests
 */

export const testConfig = {
  // SSO Server URLs
  ssoBaseUrl: process.env.SSO_BASE_URL || 'http://localhost:8080',
  ssoGrpcUrl: process.env.SSO_GRPC_URL || 'localhost:44044',

  // Test client credentials
  clientId: process.env.TEST_CLIENT_ID || 'test-client-id',

  // JWT configuration
  issuer: process.env.TEST_ISSUER || 'sso-service',

  // Public URLs for email verification and password reset
  verificationUrl: process.env.TEST_VERIFICATION_URL || 'http://localhost:3000/verify-email',
  passwordResetUrl: process.env.TEST_PASSWORD_RESET_URL || 'http://localhost:3000/reset-password',

  // Test timeouts
  defaultTimeout: 30000, // 30 seconds
  serverStartupTimeout: 60000, // 60 seconds for server to be ready
};
