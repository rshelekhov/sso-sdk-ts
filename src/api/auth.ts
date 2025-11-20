import type { Platform, SSOClientConfig, TokenData } from '../types/index.js';

import { BaseAPIClient } from './base.js';
import { API_ROUTES } from './routes.js';

import { createDeviceData, validatePublicUrl } from '../utils/index.js';

/**
 * Response from register endpoint
 */
interface RegisterResponse {
  userId: string;
  message: string;
  tokenData: TokenData;
}

/**
 * Response from login endpoint
 */
interface LoginResponse {
  tokenData: TokenData;
}

/**
 * Response from refresh endpoint
 */
interface RefreshResponse {
  tokenData: TokenData;
}

/**
 * Generic message response
 */
interface MessageResponse {
  message: string;
}

/**
 * AuthAPI handles authentication operations
 */
export class AuthAPI extends BaseAPIClient {
  private publicUrls: {
    emailVerification: string;
    passwordReset: string;
  };

  constructor(config: SSOClientConfig) {
    super(config);

    // Validate public URLs at initialization (fail fast)
    validatePublicUrl(config.publicUrls.emailVerification, 'publicUrls.emailVerification');
    validatePublicUrl(config.publicUrls.passwordReset, 'publicUrls.passwordReset');

    this.publicUrls = config.publicUrls;
  }

  /**
   * Register a new user
   * Uses configured publicUrls for email verification and password reset links
   * @param email User's email address
   * @param password User's password
   * @param name User's display name
   * @param platform Device platform (WEB, IOS, ANDROID)
   * @param clientIP Client IP address from HTTP request
   * @param userAgent User agent from HTTP request headers
   * @returns User ID, access and refresh tokens
   */
  async register(
    email: string,
    password: string,
    name: string,
    platform: Platform,
    clientIP: string,
    userAgent: string
  ): Promise<RegisterResponse> {
    return this.post<RegisterResponse>(API_ROUTES.AUTH.REGISTER, {
      email,
      password,
      name,
      verification_url: this.publicUrls.emailVerification,
      confirm_password_url: this.publicUrls.passwordReset,
      user_device_data: createDeviceData(platform, clientIP, userAgent),
    });
  }

  /**
   * Login with email and password
   * @param email User's email
   * @param password User's password
   * @param platform Device platform
   * @param clientIP Client IP address from HTTP request
   * @param userAgent User agent from HTTP request headers
   * @returns Access and refresh tokens
   */
  async login(
    email: string,
    password: string,
    platform: Platform,
    clientIP: string,
    userAgent: string
  ): Promise<TokenData> {
    const response = await this.post<LoginResponse>(API_ROUTES.AUTH.LOGIN, {
      email,
      password,
      user_device_data: createDeviceData(platform, clientIP, userAgent),
    });

    return response.tokenData;
  }

  /**
   * Verify email address using token from email link
   * @param token 64-character hexadecimal token from email link query parameter
   *   Format: Extract from URL query param: ?token=abc123...
   *   Example: "a1b2c3d4e5f6789012345678901234567890abcdefabcdef1234567890abcd"
   *   Note: Single-use token, expires after 24 hours (configurable)
   * @returns Success message
   */
  async verifyEmail(token: string): Promise<string> {
    const response = await this.get<MessageResponse>(
      `${API_ROUTES.AUTH.VERIFY_EMAIL}?token=${encodeURIComponent(token)}`
    );
    return response.message;
  }

  /**
   * Request password reset email
   * Uses configured publicUrls.passwordReset for the reset link
   * @param email User's email address
   * @returns Success message
   */
  async resetPassword(email: string): Promise<string> {
    const response = await this.post<MessageResponse>(API_ROUTES.AUTH.RESET_PASSWORD, {
      email,
      confirm_url: this.publicUrls.passwordReset,
    });
    return response.message;
  }

  /**
   * Change password using reset token from email
   * @param token 64-character hexadecimal token from email link query parameter
   *   Format: Extract from URL query param on frontend: new URLSearchParams(window.location.search).get('token')
   *   Note: Single-use token, expires after 15 minutes (configurable)
   * @param updatedPassword New password in plain text (will be hashed by SSO)
   *   ⚠️ Password confirmation should be validated on FRONTEND before calling this
   *   Frontend should: collect password + confirm → validate match → send only updatedPassword
   * @returns Success message
   */
  async changePassword(token: string, updatedPassword: string): Promise<string> {
    const response = await this.post<MessageResponse>(API_ROUTES.AUTH.CHANGE_PASSWORD, {
      token,
      updated_password: updatedPassword,
    });
    return response.message;
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken Current refresh token
   * @param platform Device platform
   * @param clientIP Client IP address from HTTP request
   * @param userAgent User agent from HTTP request headers
   * @returns New access and refresh tokens
   */
  async refreshTokens(
    refreshToken: string,
    platform: Platform,
    clientIP: string,
    userAgent: string
  ): Promise<TokenData> {
    const response = await this.post<RefreshResponse>(API_ROUTES.AUTH.REFRESH, {
      refresh_token: refreshToken,
      user_device_data: createDeviceData(platform, clientIP, userAgent),
    });

    return response.tokenData;
  }

  /**
   * Logout (invalidate current session)
   * @param accessToken Current access token
   * @param platform Device platform
   * @param clientIP Client IP address from HTTP request
   * @param userAgent User agent from HTTP request headers
   */
  async logout(
    accessToken: string,
    platform: Platform,
    clientIP: string,
    userAgent: string
  ): Promise<string> {
    const response = await this.post<MessageResponse>(
      API_ROUTES.AUTH.LOGOUT,
      {
        user_device_data: createDeviceData(platform, clientIP, userAgent),
      },
      {
        Authorization: `Bearer ${accessToken}`,
      }
    );

    return response.message;
  }
}
