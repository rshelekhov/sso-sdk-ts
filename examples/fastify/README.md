# Fastify SSO Example

This example demonstrates how to integrate the SSO SDK with a Fastify application using `@fastify/session` for token storage.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Create a `.env` file:
    ```env
    PORT=3000
    SSO_API_URL=http://localhost:8080
    SSO_CLIENT_ID=fastify-example
    SESSION_SECRET=a-secret-key-that-is-at-least-32-characters-long
    ```

3.  Run the application:
    ```bash
    npm run dev
    ```

## Features Demonstrated

*   **Token Storage**: Using `@fastify/session` to store tokens in an HTTP-only cookie.
*   **Token Restoration**: `preHandler` hook to load tokens from session into the SDK on every request.
*   **Token Persistence**: `onSend` hook to save refreshed tokens back to the session.
*   **Protected Routes**: Checking authentication status before accessing protected resources.
