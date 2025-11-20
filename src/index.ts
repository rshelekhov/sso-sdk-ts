import { AppAPI } from './api/app.js';
import { AuthAPI } from './api/auth.js';
import { UserAPI } from './api/user.js';
import type { Platform, SSOClientConfig, TokenData, User } from './types/index.js';
import { isTokenExpired } from './utils/index.js';

// Re-export types and errors for convenience
export * from './types/index.js';
export * from './errors/index.js';

/**
 * Request parameters required for operations involving user device context
 * Since this is a backend SDK, these must be extracted from HTTP requests
 */
export interface DeviceContext {
  /** Device platform (WEB, IOS, ANDROID) */
  platform: Platform;
  /** Client IP address from HTTP request */
  clientIP: string;
  /** User agent from HTTP request headers */
  userAgent: string;
  /** Optional app or browser version */
  version?: string;
}

/**
 * Request to update user profile
 */
export interface UpdateUserRequest {
  email?: string;
  currentPassword?: string;
  updatedPassword?: string;
  name?: string;
}

/**
 * Result from operations that may refresh tokens
 * Contains the operation result and potentially updated tokens
 */
export interface WithTokens<T> {
  /** The operation result */
  data: T;
  /** Potentially refreshed tokens (always check and save these) */
  tokens: TokenData;
}

/**
 * Main SSO SDK client with stateless design
 *
 * This SDK follows a stateless pattern similar to Go's http.Client:
 * - Create the client ONCE at application startup
 * - Reuse it across all requests (thread-safe)
 * - Pass tokens as function parameters (not stored in client)
 * - Client handles auto-refresh when needed
 *
 * This is a backend SDK designed for multi-user environments where
 * each HTTP request may be for a different user.
 *
 * @example
 * ```typescript
 * // Create once at startup (like Go's http.Client)
 * const ssoClient = new SSOClient({
 *   baseUrl: 'http://localhost:8080',
 *   clientId: 'my-backend-service',
 *   publicUrls: {
 *     emailVerification: 'https://myapp.com/verify-email',
 *     passwordReset: 'https://myapp.com/reset-password'
 *   }
 * });
 *
 * // In your request handler (pass tokens as parameters)
 * app.get('/api/profile', async (req, res) => {
 *   const deviceContext = {
 *     platform: Platform.WEB,
 *     clientIP: req.ip,
 *     userAgent: req.headers['user-agent']
 *   };
 *
 *   // Option 1: Simple call (you handle refresh)
 *   const user = await ssoClient.getProfile(
 *     req.session.tokens.accessToken,
 *     deviceContext
 *   );
 *
 *   // Option 2: Auto-refresh (recommended)
 *   const { data: user, tokens } = await ssoClient.getProfileWithRefresh(
 *     req.session.tokens,
 *     deviceContext
 *   );
 *   req.session.tokens = tokens; // Save refreshed tokens
 *
 *   res.json(user);
 * });
 * ```
 */
export class SSOClient {
  /** Authentication API client */
  public readonly auth: AuthAPI;

  /** User management API client */
  public readonly user: UserAPI;

  /** Client application management API client */
  public readonly app: AppAPI;

  /**
   * Create a new SSO client
   *
   * Create this ONCE at application startup and reuse it.
   * The client is stateless and safe to use across multiple requests.
   */
  constructor(config: SSOClientConfig) {
    this.auth = new AuthAPI(config);
    this.user = new UserAPI(config);
    this.app = new AppAPI(config);
  }

  // ============ Helper Methods ============

  /**
   * Check if an access token is expired or about to expire
   * @param expiresAt Expiration timestamp from TokenData
   * @returns true if token is expired or will expire within 60 seconds
   */
  isTokenExpired(expiresAt: string): boolean {
    return isTokenExpired(expiresAt);
  }

  /**
   * Ensure tokens are valid, refresh if needed
   * @param tokens Current token data
   * @param deviceContext Device context for refresh operation
   * @returns Valid access token and potentially refreshed tokens
   * @private Internal helper
   */
  private async ensureValidTokens(
    tokens: TokenData,
    deviceContext: DeviceContext
  ): Promise<{ accessToken: string; tokens: TokenData }> {
    // Check if token needs refresh
    if (isTokenExpired(tokens.expiresAt)) {
      const refreshedTokens = await this.auth.refreshTokens(
        tokens.refreshToken,
        deviceContext.platform,
        deviceContext.clientIP,
        deviceContext.userAgent
      );
      return { accessToken: refreshedTokens.accessToken, tokens: refreshedTokens };
    }

    return { accessToken: tokens.accessToken, tokens };
  }

  // ============ Authentication Methods ============

  /**
   * Register a new user
   * Uses configured publicUrls for email verification and password reset links
   *
   * @param email User's email address
   * @param password User's password
   * @param name User's display name
   * @param deviceContext Device context from HTTP request
   * @returns User ID, message, and optional token data
   *
   * @example
   * ```typescript
   * const result = await ssoClient.register(
   *   'user@example.com',
   *   'password123',
   *   'John Doe',
   *   deviceContext
   * );
   *
   * if (result.tokenData) {
   *   // Store tokens in session/database
   *   req.session.tokens = result.tokenData;
   * }
   * ```
   */
  async register(
    email: string,
    password: string,
    name: string,
    deviceContext: DeviceContext
  ): Promise<{ userId: string; message: string; tokenData?: TokenData }> {
    return this.auth.register(
      email,
      password,
      name,
      deviceContext.platform,
      deviceContext.clientIP,
      deviceContext.userAgent
    );
  }

  /**
   * Login with email and password
   *
   * @param email User's email
   * @param password User's password
   * @param deviceContext Device context from HTTP request
   * @returns Access and refresh tokens
   *
   * @example
   * ```typescript
   * const tokens = await ssoClient.login(
   *   'user@example.com',
   *   'password123',
   *   deviceContext
   * );
   *
   * // Store tokens in session/database
   * req.session.tokens = tokens;
   * ```
   */
  async login(email: string, password: string, deviceContext: DeviceContext): Promise<TokenData> {
    return this.auth.login(
      email,
      password,
      deviceContext.platform,
      deviceContext.clientIP,
      deviceContext.userAgent
    );
  }

  /**
   * Verify email address using token from email link
   * @param token 64-character hexadecimal token from email link query parameter
   * @returns Success message
   */
  async verifyEmail(token: string): Promise<string> {
    return this.auth.verifyEmail(token);
  }

  /**
   * Request password reset email
   * Uses configured publicUrls.passwordReset for the reset link
   * @param email User's email address
   * @returns Success message
   */
  async resetPassword(email: string): Promise<string> {
    return this.auth.resetPassword(email);
  }

  /**
   * Change password using reset token from email
   * @param token 64-character hexadecimal token from email link query parameter
   * @param updatedPassword New password in plain text
   * @returns Success message
   */
  async changePassword(token: string, updatedPassword: string): Promise<string> {
    return this.auth.changePassword(token, updatedPassword);
  }

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken Current refresh token
   * @param deviceContext Device context from HTTP request
   * @returns New token pair
   *
   * @example
   * ```typescript
   * const newTokens = await ssoClient.refreshTokens(
   *   currentTokens.refreshToken,
   *   deviceContext
   * );
   *
   * // Save new tokens
   * req.session.tokens = newTokens;
   * ```
   */
  async refreshTokens(refreshToken: string, deviceContext: DeviceContext): Promise<TokenData> {
    return this.auth.refreshTokens(
      refreshToken,
      deviceContext.platform,
      deviceContext.clientIP,
      deviceContext.userAgent
    );
  }

  /**
   * Logout current session
   *
   * @param accessToken Current access token
   * @param deviceContext Device context from HTTP request
   * @returns Success message
   *
   * @example
   * ```typescript
   * await ssoClient.logout(
   *   req.session.tokens.accessToken,
   *   deviceContext
   * );
   *
   * // Clear tokens from session
   * delete req.session.tokens;
   * ```
   */
  async logout(accessToken: string, deviceContext: DeviceContext): Promise<string> {
    return this.auth.logout(
      accessToken,
      deviceContext.platform,
      deviceContext.clientIP,
      deviceContext.userAgent
    );
  }

  // ============ User Profile Methods (Simple - No Auto-Refresh) ============

  /**
   * Get current authenticated user's profile
   *
   * @param accessToken Valid access token
   * @param deviceContext Device context (not used for this endpoint, but included for consistency)
   * @returns User profile data
   *
   * @example
   * ```typescript
   * const user = await ssoClient.getProfile(
   *   req.session.tokens.accessToken,
   *   deviceContext
   * );
   * ```
   */
  async getProfile(accessToken: string, deviceContext: DeviceContext): Promise<User> {
    return this.user.getUser(accessToken);
  }

  /**
   * Get user profile by ID (admin operation)
   *
   * @param accessToken Valid access token
   * @param userId Target user's unique identifier
   * @param deviceContext Device context
   * @returns User profile data
   */
  async getProfileByID(
    accessToken: string,
    userId: string,
    deviceContext: DeviceContext
  ): Promise<User> {
    return this.user.getUserByID(accessToken, userId);
  }

  /**
   * Update current user's profile
   *
   * @param accessToken Valid access token
   * @param updates Fields to update (email, name, password)
   * @param deviceContext Device context
   * @returns Updated user information
   */
  async updateProfile(
    accessToken: string,
    updates: UpdateUserRequest,
    deviceContext: DeviceContext
  ): Promise<{ email: string; name: string; updatedAt: string }> {
    return this.user.updateUser(accessToken, updates);
  }

  /**
   * Delete current authenticated user's account
   *
   * @param accessToken Valid access token
   * @param deviceContext Device context
   * @returns Success status
   */
  async deleteAccount(accessToken: string, deviceContext: DeviceContext): Promise<boolean> {
    return this.user.deleteUser(accessToken);
  }

  /**
   * Delete user account by ID (admin operation)
   *
   * @param accessToken Valid access token
   * @param userId Target user's unique identifier to delete
   * @param deviceContext Device context
   * @returns Success status
   */
  async deleteAccountByID(
    accessToken: string,
    userId: string,
    deviceContext: DeviceContext
  ): Promise<boolean> {
    return this.user.deleteUserByID(accessToken, userId);
  }

  /**
   * Search for users by email or name
   *
   * @param accessToken Valid access token
   * @param query Search query (email or name)
   * @param deviceContext Device context
   * @param pageSize Number of results per page (default: 50, max: 100)
   * @param pageToken Cursor for pagination (optional)
   * @returns Search results with pagination info
   */
  async searchUsers(
    accessToken: string,
    query: string,
    deviceContext: DeviceContext,
    pageSize?: number,
    pageToken?: string
  ): Promise<{
    users: User[];
    totalCount: number;
    nextPageToken: string;
    hasMore: boolean;
  }> {
    return this.user.searchUsers(accessToken, query, pageSize, pageToken);
  }

  // ============ User Profile Methods (With Auto-Refresh) ============

  /**
   * Get current user's profile with automatic token refresh
   *
   * This method automatically refreshes the access token if it's expired.
   * Always save the returned tokens as they may have been refreshed.
   *
   * @param tokens Current token data
   * @param deviceContext Device context for token refresh (if needed)
   * @returns User profile and potentially refreshed tokens
   *
   * @example
   * ```typescript
   * const { data: user, tokens } = await ssoClient.getProfileWithRefresh(
   *   req.session.tokens,
   *   deviceContext
   * );
   *
   * // IMPORTANT: Save tokens (may have been refreshed)
   * req.session.tokens = tokens;
   *
   * res.json(user);
   * ```
   */
  async getProfileWithRefresh(
    tokens: TokenData,
    deviceContext: DeviceContext
  ): Promise<WithTokens<User>> {
    const { accessToken, tokens: validTokens } = await this.ensureValidTokens(
      tokens,
      deviceContext
    );
    const user = await this.user.getUser(accessToken);
    return { data: user, tokens: validTokens };
  }

  /**
   * Get user profile by ID with automatic token refresh (admin operation)
   */
  async getProfileByIDWithRefresh(
    tokens: TokenData,
    userId: string,
    deviceContext: DeviceContext
  ): Promise<WithTokens<User>> {
    const { accessToken, tokens: validTokens } = await this.ensureValidTokens(
      tokens,
      deviceContext
    );
    const user = await this.user.getUserByID(accessToken, userId);
    return { data: user, tokens: validTokens };
  }

  /**
   * Update user profile with automatic token refresh
   */
  async updateProfileWithRefresh(
    tokens: TokenData,
    updates: UpdateUserRequest,
    deviceContext: DeviceContext
  ): Promise<WithTokens<{ email: string; name: string; updatedAt: string }>> {
    const { accessToken, tokens: validTokens } = await this.ensureValidTokens(
      tokens,
      deviceContext
    );
    const result = await this.user.updateUser(accessToken, updates);
    return { data: result, tokens: validTokens };
  }

  /**
   * Delete current user's account with automatic token refresh
   */
  async deleteAccountWithRefresh(
    tokens: TokenData,
    deviceContext: DeviceContext
  ): Promise<WithTokens<boolean>> {
    const { accessToken, tokens: validTokens } = await this.ensureValidTokens(
      tokens,
      deviceContext
    );
    const success = await this.user.deleteUser(accessToken);
    return { data: success, tokens: validTokens };
  }

  /**
   * Delete user account by ID with automatic token refresh (admin operation)
   */
  async deleteAccountByIDWithRefresh(
    tokens: TokenData,
    userId: string,
    deviceContext: DeviceContext
  ): Promise<WithTokens<boolean>> {
    const { accessToken, tokens: validTokens } = await this.ensureValidTokens(
      tokens,
      deviceContext
    );
    const success = await this.user.deleteUserByID(accessToken, userId);
    return { data: success, tokens: validTokens };
  }

  /**
   * Search users with automatic token refresh
   */
  async searchUsersWithRefresh(
    tokens: TokenData,
    query: string,
    deviceContext: DeviceContext,
    pageSize?: number,
    pageToken?: string
  ): Promise<
    WithTokens<{
      users: User[];
      totalCount: number;
      nextPageToken: string;
      hasMore: boolean;
    }>
  > {
    const { accessToken, tokens: validTokens } = await this.ensureValidTokens(
      tokens,
      deviceContext
    );
    const results = await this.user.searchUsers(accessToken, query, pageSize, pageToken);
    return { data: results, tokens: validTokens };
  }

  // ============ Client Application Methods ============

  /**
   * Register a new client application in the SSO system
   * Creates client credentials and configuration for SSO integration
   *
   * @param clientName Human-readable client name for identification
   * @returns Empty response on success
   */
  async registerClient(clientName: string): Promise<void> {
    return this.app.registerClient(clientName);
  }
}
