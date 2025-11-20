# Express.js SSO Example

This example demonstrates how to integrate the SSO SDK with an Express.js application using `express-session` for token storage.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Create a `.env` file:
    ```env
    PORT=3000
    SSO_API_URL=http://localhost:8080
    SSO_CLIENT_ID=express-example
    SESSION_SECRET=your-secret-key
    ```

3.  Run the application:
    ```bash
    npm run dev
    ```

## Features Demonstrated

*   **Token Storage**: Using `express-session` to store tokens in an HTTP-only cookie.
*   **Token Restoration**: Middleware to load tokens from session into the SDK on every request.
*   **Token Persistence**: Middleware to save refreshed tokens back to the session.
*   **Protected Routes**: Checking authentication status before accessing protected resources.
*   **Device Context**: Extracting IP and User Agent from the request.
