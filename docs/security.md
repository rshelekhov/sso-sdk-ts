# Security Guide

Security is a shared responsibility. While the SSO SDK handles the complexity of token management and authentication protocols, you must ensure that tokens are stored and transmitted securely within your application infrastructure.

## Token Security Basics

The SDK uses **Bearer Tokens**. This means that anyone who possesses the access token can act as the user. Therefore, protecting these tokens is paramount.

### Token Structure
*   **Access Token**: Short-lived JWT (JSON Web Token) used to access protected resources.
*   **Refresh Token**: Longer-lived opaque token used to obtain new access tokens.

## Token Storage Security

Since the SDK is storage-agnostic, you must choose a secure storage mechanism.

### ❌ Don'ts
*   **NEVER** store tokens in `localStorage` or `sessionStorage` in browser environments (vulnerable to XSS).
*   **NEVER** log tokens to console or file logs.
*   **NEVER** expose tokens in URLs (query parameters).
*   **NEVER** store tokens in plain text in a database without encryption.

### ✅ Do's

#### 1. Server-Side Sessions (Recommended)
Store tokens in a server-side session store (Redis, Database, Memory).
*   **Cookie Security**: The session ID cookie should be `HttpOnly`, `Secure`, and `SameSite=Strict`.
*   **Encryption**: Encrypt the session data at rest if possible.

#### 2. Encrypted Database Storage
If storing tokens in a database (e.g., for a "Remember Me" feature or mobile apps):
*   **Encrypt at Rest**: Use column-level encryption or application-level encryption (AES-256-GCM) before writing the token to the DB.
*   **Key Management**: Rotate encryption keys regularly. Use a KMS (Key Management Service) if available.

#### 3. Redis Security
If using Redis for session/token storage:
*   **TLS**: Enable TLS for data in transit between your app and Redis.
*   **Auth**: Use strong passwords/ACLs for Redis access.
*   **Network**: Ensure Redis is not exposed to the public internet.

## Transport Security

*   **HTTPS is Mandatory**: All communication between the client, your server, and the SSO service MUST be over HTTPS.
*   **HSTS**: Enable HTTP Strict Transport Security (HSTS) headers to prevent protocol downgrade attacks.

## Token Lifecycle Security

### Expiration
*   **Access Tokens**: Have a short lifetime (e.g., 15 minutes). This limits the window of opportunity if a token is stolen.
*   **Refresh Tokens**: Have a longer lifetime but can be revoked.

### Revocation
*   **Logout**: Always call `ssoClient.logout()` to invalidate the refresh token on the server side.
*   **Rotation**: The SDK handles refresh token rotation automatically. When a refresh token is used, a new one is issued, and the old one is invalidated. This detects token theft (if an attacker tries to use an old refresh token, the system can lock the account).

## Common Vulnerabilities & Mitigation

| Vulnerability | Risk | Mitigation |
| :--- | :--- | :--- |
| **XSS (Cross-Site Scripting)** | High | Store tokens in `HttpOnly` cookies. Sanitize user input. Use CSP headers. |
| **CSRF (Cross-Site Request Forgery)** | Medium | Use `SameSite=Strict` cookies. Implement CSRF tokens for state-changing requests. |
| **Session Fixation** | Medium | Regenerate session IDs after login. |
| **Token Theft** | High | Use short-lived access tokens. Implement refresh token rotation. |
