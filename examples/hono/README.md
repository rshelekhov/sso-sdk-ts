# Hono SSO Example

This example demonstrates how to integrate the SSO SDK with a Hono application. It works with Node.js, Bun, and Cloudflare Workers (with minor adaptations).

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Create a `.env` file:
    ```env
    PORT=3000
    SSO_API_URL=http://localhost:8080
    SSO_CLIENT_ID=hono-example
    ```

3.  Run the application:
    ```bash
    npm run dev
    ```

## Features Demonstrated

*   **Token Storage**: Using a simple in-memory session store with cookies.
*   **Token Restoration**: Middleware to load tokens from the session into the SDK.
*   **Token Persistence**: Middleware to save refreshed tokens back to the session.
*   **Cross-Runtime Support**: Designed to work with Hono's standard API.

## Runtime Support

This example is configured to run on Node.js using `@hono/node-server`.

To run with **Bun**:
```bash
bun run src/index.ts
```
(You may need to adjust the `serve` import or use `export default app` for Bun native server).
