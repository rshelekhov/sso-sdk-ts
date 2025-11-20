# NestJS SSO Example

This example demonstrates how to integrate the SSO SDK with a NestJS application using `express-session` and a custom Interceptor for token management.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Create a `.env` file:
    ```env
    PORT=3000
    SSO_API_URL=http://localhost:8080
    SSO_CLIENT_ID=nestjs-example
    SESSION_SECRET=nestjs-secret-key
    ```

3.  Run the application:
    ```bash
    npm run start:dev
    ```

## Features Demonstrated

*   **Dependency Injection**: `SSOService` is injected into controllers and interceptors.
*   **Request Scope**: `SSOService` is request-scoped to handle per-request token state.
*   **Interceptors**: `SSOInterceptor` automatically restores tokens from session before the handler and persists them after.
*   **Guards**: (Optional) Can be added to protect routes based on `ssoClient.isAuthenticated()`.
*   **Decorators**: Uses standard NestJS decorators for request handling.
