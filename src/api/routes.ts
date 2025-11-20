/**
 * Centralized API route constants
 * Single source of truth for all SSO API endpoints
 */
export const API_ROUTES = {
  /**
   * Authentication endpoints
   */
  AUTH: {
    REGISTER: '/v1/auth/register',
    LOGIN: '/v1/auth/login',
    VERIFY_EMAIL: '/v1/auth/verify-email',
    RESET_PASSWORD: '/v1/auth/reset-password',
    CHANGE_PASSWORD: '/v1/auth/change-password',
    REFRESH: '/v1/auth/refresh',
    LOGOUT: '/v1/auth/logout',
    JWKS: '/v1/auth/.well-known/jwks.json',
  },

  /**
   * User management endpoints
   */
  USER: {
    GET: '/v1/user',
    BY_ID: (userId: string) => `/v1/user/${userId}`,
    UPDATE: '/v1/user',
    DELETE: '/v1/user',
    DELETE_BY_ID: (userId: string) => `/v1/user/${userId}`,
    SEARCH: '/v1/users/search',
  },

  /**
   * Client management endpoints
   */
  CLIENT: {
    REGISTER: '/v1/clients/register',
  },
} as const;
