import type { User } from '../types/index.js';

import { BaseAPIClient } from './base.js';
import { API_ROUTES } from './routes.js';

/**
 * Response from getUser endpoint
 */
interface GetUserResponse {
  user: User;
}

/**
 * Response from getUserByID endpoint
 */
interface GetUserByIDResponse {
  user: User;
}

/**
 * Request to update user profile
 */
interface UpdateUserRequest {
  email?: string;
  currentPassword?: string;
  updatedPassword?: string;
  name?: string;
}

/**
 * Response from updateUser endpoint
 */
interface UpdateUserResponse {
  email: string;
  name: string;
  updatedAt: string;
}

/**
 * Response from deleteUser endpoint
 */
interface DeleteUserResponse {
  success: boolean;
}

/**
 * Response from deleteUserByID endpoint
 */
interface DeleteUserByIDResponse {
  success: boolean;
}

/**
 * Request for searching users
 */
interface SearchUsersRequest {
  query: string;
  pageSize?: number;
  pageToken?: string;
}

/**
 * Response from searchUsers endpoint
 */
interface SearchUsersResponse {
  users: User[];
  totalCount: number;
  nextPageToken: string;
  hasMore: boolean;
}

/**
 * UserAPI handles user profile operations
 */
export class UserAPI extends BaseAPIClient {
  /**
   * Get current authenticated user's profile
   * @param accessToken Current access token
   * @returns User profile data
   */
  async getUser(accessToken: string): Promise<User> {
    const response = await this.get<GetUserResponse>(API_ROUTES.USER.GET, {
      Authorization: `Bearer ${accessToken}`,
    });

    return response.user;
  }

  /**
   * Get user profile by ID (admin operation)
   * @param accessToken Current access token
   * @param userId Target user's unique identifier
   * @returns User profile data
   */
  async getUserByID(accessToken: string, userId: string): Promise<User> {
    const response = await this.get<GetUserByIDResponse>(API_ROUTES.USER.BY_ID(userId), {
      Authorization: `Bearer ${accessToken}`,
    });

    return response.user;
  }

  /**
   * Update current user's profile
   * @param accessToken Current access token
   * @param updates Fields to update
   * @returns Updated user information
   */
  async updateUser(accessToken: string, updates: UpdateUserRequest): Promise<UpdateUserResponse> {
    const body: Record<string, string> = {};

    if (updates.email) body.email = updates.email;
    if (updates.name) body.name = updates.name;
    if (updates.currentPassword) body.current_password = updates.currentPassword;
    if (updates.updatedPassword) body.updated_password = updates.updatedPassword;

    const response = await this.patch<UpdateUserResponse>(API_ROUTES.USER.UPDATE, body, {
      Authorization: `Bearer ${accessToken}`,
    });

    return response;
  }

  /**
   * Delete current authenticated user's account
   * @param accessToken Current access token
   * @returns Success status
   */
  async deleteUser(accessToken: string): Promise<boolean> {
    const response = await this.delete<DeleteUserResponse>(API_ROUTES.USER.DELETE, {
      Authorization: `Bearer ${accessToken}`,
    });

    return response.success;
  }

  /**
   * Delete user account by ID (admin operation)
   * @param accessToken Current access token
   * @param userId Target user's unique identifier to delete
   * @returns Success status
   */
  async deleteUserByID(accessToken: string, userId: string): Promise<boolean> {
    const response = await this.delete<DeleteUserByIDResponse>(
      API_ROUTES.USER.DELETE_BY_ID(userId),
      {
        Authorization: `Bearer ${accessToken}`,
      }
    );

    return response.success;
  }

  /**
   * Search for users by email or name
   * @param accessToken Current access token
   * @param query Search query (email or name)
   * @param pageSize Number of results per page (default: 50, max: 100)
   * @param pageToken Cursor for pagination (optional)
   * @returns Search results with pagination info
   */
  async searchUsers(
    accessToken: string,
    query: string,
    pageSize?: number,
    pageToken?: string
  ): Promise<SearchUsersResponse> {
    const params = new URLSearchParams({ query });
    if (pageSize) params.set('page_size', pageSize.toString());
    if (pageToken) params.set('page_token', pageToken);

    const response = await this.get<SearchUsersResponse>(
      `${API_ROUTES.USER.SEARCH}?${params.toString()}`,
      {
        Authorization: `Bearer ${accessToken}`,
      }
    );

    return response;
  }
}
