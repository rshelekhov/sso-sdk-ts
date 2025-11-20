import type { APIErrorResponse, SSOClientConfig } from '../types/index.js';

import { SSOError, parseAPIError } from '../errors/index.js';

/**
 * BaseAPIClient handles all HTTP communication with the SSO API
 * Other API classes (AuthAPI, UserAPI, AppAPI) will extend this
 */
export class BaseAPIClient {
  protected baseUrl: string;
  protected clientId: string;
  protected timeout: number;

  constructor(config: SSOClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash from baseUrl
    this.clientId = config.clientId;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Make an HTTP request
   * This is the core method that all API calls use
   */
  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Set up headers
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Client-Id', this.clientId);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Read response body
      const data = await response.json();

      // Check if request was successful
      if (!response.ok) {
        throw parseAPIError(response.status, data as APIErrorResponse);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw our custom SSO errors
      if (error instanceof SSOError) {
        throw error;
      }

      // Handle timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      // Handle other network errors
      throw new Error(`Network error: ${error}`);
    }
  }

  /**
   * Make a GET request
   */
  protected async get<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers,
    });
  }

  /**
   * Make a POST request
   */
  protected async post<T>(endpoint: string, body?: unknown, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a PATCH request
   */
  protected async patch<T>(endpoint: string, body?: unknown, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a DELETE request
   */
  protected async delete<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers,
    });
  }
}
