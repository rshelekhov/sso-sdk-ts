import { serve } from '@hono/node-server';
import {
  AuthMiddleware,
  Platform,
  SSOClient,
  type JWTClaims,
  type TokenData,
} from '@rshelekhov/sso-sdk';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

dotenv.config();

const app = new Hono();
const port = Number(process.env.PORT) || 3000;

// Initialize SSO Client
const ssoClient = new SSOClient({
  baseUrl: process.env.SSO_API_URL || 'http://localhost:8080',
  clientId: process.env.SSO_CLIENT_ID || 'hono-example',
  publicUrls: {
    emailVerification: 'http://localhost:3000/verify-email',
    passwordReset: 'http://localhost:3000/reset-password',
  },
});

// Initialize Auth Middleware for JWT validation
const authMiddleware = new AuthMiddleware({
  jwksUrl: `${process.env.SSO_API_URL || 'http://localhost:8080'}/v1/auth/.well-known/jwks.json`,
  issuer: process.env.SSO_ISSUER || 'sso-service',
  audience: process.env.SSO_CLIENT_ID || 'hono-example',
  clientId: process.env.SSO_CLIENT_ID || 'hono-example',
});

// Simple in-memory session store
const sessionStore = new Map<string, { tokens?: TokenData }>();

// Session Middleware
app.use('*', async (c, next) => {
  const sessionId = getCookie(c, 'session_id');
  let session = sessionId ? sessionStore.get(sessionId) : undefined;

  if (session) {
    c.set('sessionId', sessionId);
  } else {
    session = {};
    const newSessionId = randomBytes(16).toString('hex');
    sessionStore.set(newSessionId, session);
    setCookie(c, 'session_id', newSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });
    // Attach session id to context for later use if needed
    c.set('sessionId', newSessionId);
  }

  // Restore tokens
  if (session.tokens) {
    ssoClient.setTokens(session.tokens);
  }

  await next();

  // Persist tokens (handle refresh)
  const tokens = ssoClient.getTokens();
  if (tokens) {
    session.tokens = tokens;
  } else if (session.tokens && !tokens) {
    // Tokens were cleared (logout)
    delete session.tokens;
  }
});

// Helper to get device context
const getDeviceContext = (c: any) => {
  const userAgent = c.req.header('user-agent') || 'unknown';
  // Hono doesn't provide IP directly in all environments, mock for example
  const clientIP = '127.0.0.1';

  return {
    platform: Platform.WEB,
    clientIP,
    userAgent,
  };
};

// Routes

app.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    const tokens = await ssoClient.login(email, password, getDeviceContext(c));

    // Save to session
    const sessionId = c.get('sessionId');
    if (sessionId && sessionStore.has(sessionId)) {
      sessionStore.get(sessionId)!.tokens = tokens;
    }

    return c.json({ message: 'Logged in successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 401);
  }
});

app.post('/register', async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    const result = await ssoClient.register(email, password, name, getDeviceContext(c));
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/logout', async (c) => {
  try {
    await ssoClient.logout(getDeviceContext(c));

    const sessionId = c.get('sessionId');
    if (sessionId) {
      sessionStore.delete(sessionId);
      deleteCookie(c, 'session_id');
    }

    return c.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/profile', async (c) => {
  try {
    if (!ssoClient.isAuthenticated()) {
      return c.json({ error: 'Not authenticated' }, 401);
    }
    const user = await ssoClient.getProfile(getDeviceContext(c));
    return c.json(user);
  } catch (error: any) {
    return c.json({ error: error.message }, 401);
  }
});

// Protected route using JWT middleware (validates token via JWKS)
app.get('/api/protected', authMiddleware.hono(), async (c) => {
  const user = c.get('ssoUser') as JWTClaims;
  return c.json({
    message: 'Access granted',
    userId: user.user_id,
    appId: user.app_id,
  });
});

console.log(`Server running at http://localhost:${port}`);
serve({
  fetch: app.fetch,
  port,
});
