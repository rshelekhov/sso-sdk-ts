import { BaseAPIClient } from './base.js';
import { API_ROUTES } from './routes.js';

/**
 * Response from registerClient endpoint
 */
interface RegisterClientResponse {}

/**
 * AppAPI handles client application management
 * Used for registering new client applications in the SSO system
 */
export class AppAPI extends BaseAPIClient {
  /**
   * Register a new client application in the SSO system
   * Creates client credentials and configuration for SSO integration
   * @param clientName Human-readable client name for identification
   * @returns Empty response on success
   * @example
   * const appAPI = new AppAPI(config);
   * await appAPI.registerClient('MyBackendService');
   */
  async registerClient(clientName: string): Promise<void> {
    await this.post<RegisterClientResponse>(API_ROUTES.CLIENT.REGISTER, {
      client_name: clientName,
    });
  }
}
