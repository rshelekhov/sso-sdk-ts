import type { UserDeviceData } from '../types/index.js';
import { Platform } from '../types/index.js';

/**
 * Create device data for requests
 * @param platform Platform type (WEB, IOS, ANDROID)
 * @param clientIP Client IP address from HTTP request (e.g., req.headers['x-forwarded-for'] or req.socket.remoteAddress)
 * @param userAgent User agent from HTTP request headers (e.g., req.headers['user-agent'])
 * @param version App version (for mobile) or browser version (for web) - optional but recommended
 * @returns UserDeviceData object for SSO API requests
 * @example
 * // In Express/Bun server (Web)
 * const deviceData = createDeviceData(
 *   Platform.WEB,
 *   req.headers['x-forwarded-for'] || req.socket.remoteAddress,
 *   req.headers['user-agent'],
 *   'Chrome/120.0'
 * );
 *
 * // For mobile app (iOS)
 * const deviceData = createDeviceData(
 *   Platform.iOS,
 *   clientIP,
 *   userAgent,
 *   '1.0.5'
 * );
 */
export function createDeviceData(
  platform: Platform,
  clientIP: string,
  userAgent: string,
  version?: string
): UserDeviceData {
  const deviceData: UserDeviceData = {
    userAgent,
    ip: clientIP,
    platform,
  };

  // Add version based on platform
  if (version) {
    if (platform === Platform.WEB) {
      deviceData.browserVersion = version;
    } else if (platform === Platform.iOS || platform === Platform.ANDROID) {
      deviceData.appVersion = version;
    }
  }

  return deviceData;
}

/**
 * Check if a token is expired or about to expire
 * @param expiresAt ISO 8601 date string
 * @param bufferSeconds Consider expired if expiring in this many seconds (default: 60)
 */
export function isTokenExpired(expiresAt: string, bufferSeconds: number = 60): boolean {
  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const bufferMs = bufferSeconds * 1000;

  return expiryTime - now < bufferMs;
}

/**
 * Validate that a URL is suitable for public access (end users clicking email links)
 * @param url URL to validate
 * @param fieldName Name of the field for error messages
 * @throws Error if URL is invalid
 * @example
 * validatePublicUrl("https://myapp.com/verify", "verificationUrl");
 */
export function validatePublicUrl(url: string, fieldName: string): void {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Warn about localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      console.warn(
        `⚠️ ${fieldName}: Using localhost URL "${url}". ` +
          `End users won't be able to access this from email links!`
      );
    }

    // Warn about private IPs (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
    if (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)
    ) {
      console.warn(
        `⚠️ ${fieldName}: Using private IP "${url}". ` +
          `End users won't be able to access this from email links!`
      );
    }

    // Warn about internal service names (no dots = not FQDN)
    if (!hostname.includes('.') && hostname !== 'localhost') {
      console.warn(
        `⚠️ ${fieldName}: Using internal hostname "${url}". ` +
          `End users won't be able to access this from email links! ` +
          `Use a public domain instead.`
      );
    }
  } catch (_error) {
    throw new Error(`${fieldName}: Invalid URL format "${url}"`);
  }
}
