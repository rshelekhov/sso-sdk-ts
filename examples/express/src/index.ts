import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';

import { Platform, SSOClient, TokenData } from '@rshelekhov/sso-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Create SSO Client ONCE at startup (stateless, reusable)
const ssoClient = new SSOClient({
  baseUrl: process.env.SSO_API_URL || 'http://localhost:8080',
  clientId: process.env.SSO_CLIENT_ID || 'express-example',
  publicUrls: {
    emailVerification: 'http://localhost:3000/verify-email',
    passwordReset: 'http://localhost:3000/reset-password',
  },
});

// Extend Express Session interface
declare module 'express-session' {
  interface SessionData {
    tokens?: TokenData;
  }
}

// Middleware Setup
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Helper to get device context from request
const getDeviceContext = (req: express.Request) => ({
  platform: Platform.WEB,
  clientIP: req.ip || '127.0.0.1',
  userAgent: req.headers['user-agent'] || 'unknown',
});

// Routes

/**
 * Login endpoint
 * Creates new session with tokens
 */
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Login and get tokens (stateless call)
    const tokens = await ssoClient.login(email, password, getDeviceContext(req));

    // Store tokens in session
    req.session.tokens = tokens;

    res.json({ message: 'Logged in successfully' });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * Register endpoint
 * Creates new user account
 */
app.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Register user (stateless call)
    const result = await ssoClient.register(email, password, name, getDeviceContext(req));

    // If tokens are returned, store them
    if (result.tokenData) {
      req.session.tokens = result.tokenData;
    }

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Logout endpoint
 * Invalidates session on SSO server
 */
app.post('/logout', async (req, res) => {
  try {
    if (req.session.tokens) {
      // Logout from SSO (pass tokens as parameter)
      await ssoClient.logout(req.session.tokens.accessToken, getDeviceContext(req));
    }

    // Clear session
    req.session.destroy(() => {});

    res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get profile endpoint (with automatic token refresh)
 * Demonstrates the recommended WithRefresh pattern
 */
app.get('/profile', async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get profile with auto-refresh (stateless call)
    // SDK will automatically refresh if token is expired
    const { data: user, tokens } = await ssoClient.getProfileWithRefresh(
      req.session.tokens,
      getDeviceContext(req)
    );

    // IMPORTANT: Save potentially refreshed tokens
    req.session.tokens = tokens;

    res.json(user);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * Alternative profile endpoint (manual refresh handling)
 * Shows how to handle refresh manually if preferred
 */
app.get('/profile-manual', async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if token is expired
    if (ssoClient.isTokenExpired(req.session.tokens.expiresAt)) {
      // Manually refresh tokens
      const newTokens = await ssoClient.refreshTokens(
        req.session.tokens.refreshToken,
        getDeviceContext(req)
      );

      req.session.tokens = newTokens;
    }

    // Get profile with valid token (stateless call)
    const user = await ssoClient.getProfile(
      req.session.tokens.accessToken,
      getDeviceContext(req)
    );

    res.json(user);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * Update profile endpoint
 */
app.patch('/profile', async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const updates = req.body;

    // Update profile with auto-refresh
    const { data: result, tokens } = await ssoClient.updateProfileWithRefresh(
      req.session.tokens,
      updates,
      getDeviceContext(req)
    );

    // Save potentially refreshed tokens
    req.session.tokens = tokens;

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Search users endpoint (admin operation)
 */
app.get('/users/search', async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { q, pageSize, pageToken } = req.query;

    // Search with auto-refresh
    const { data: results, tokens } = await ssoClient.searchUsersWithRefresh(
      req.session.tokens,
      q as string,
      getDeviceContext(req),
      pageSize ? Number(pageSize) : undefined,
      pageToken as string | undefined
    );

    // Save potentially refreshed tokens
    req.session.tokens = tokens;

    res.json(results);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Express example running at http://localhost:${port}`);
  console.log(`
Available endpoints:
  POST   /login           - Login with email/password
  POST   /register        - Register new user
  POST   /logout          - Logout current session
  GET    /profile         - Get user profile (auto-refresh)
  GET    /profile-manual  - Get user profile (manual refresh)
  PATCH  /profile         - Update user profile
  GET    /users/search    - Search users (admin)
  GET    /health          - Health check
  `);
});
