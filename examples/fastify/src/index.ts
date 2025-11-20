import fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { SSOClient, Platform, TokenData } from '@rshelekhov/sso-sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = fastify({ logger: true });

// Initialize SSO Client
const ssoClient = new SSOClient({
  baseUrl: process.env.SSO_API_URL || 'http://localhost:8080',
  clientId: process.env.SSO_CLIENT_ID || 'fastify-example',
  publicUrls: {
    emailVerification: 'http://localhost:3000/verify-email',
    passwordReset: 'http://localhost:3000/reset-password'
  }
});

// Extend Fastify Session interface
declare module 'fastify' {
  interface Session {
    tokens?: TokenData;
  }
}

// Register plugins
app.register(fastifyCookie);
app.register(fastifySession, {
  secret: process.env.SESSION_SECRET || 'a-secret-key-that-is-at-least-32-characters-long',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  saveUninitialized: false
});

// Hook to restore tokens from session
app.addHook('preHandler', async (req, reply) => {
  if (req.session.tokens) {
    ssoClient.setTokens(req.session.tokens);
  }
});

// Hook to persist tokens (handle refresh)
app.addHook('onSend', async (req, reply, payload) => {
  const tokens = ssoClient.getTokens();
  if (tokens) {
    req.session.tokens = tokens;
  } else if (req.session.tokens && !tokens) {
    // Tokens were cleared (logout)
    req.session.tokens = undefined;
  }
});

// Helper to get device context
const getDeviceContext = (req: any) => ({
  platform: Platform.WEB,
  clientIP: req.ip || '127.0.0.1',
  userAgent: req.headers['user-agent'] || 'unknown'
});

// Routes

app.post('/login', async (req, reply) => {
  try {
    const { email, password } = req.body as any;
    const tokens = await ssoClient.login(email, password, getDeviceContext(req));
    req.session.tokens = tokens;
    return { message: 'Logged in successfully' };
  } catch (error: any) {
    reply.code(401).send({ error: error.message });
  }
});

app.post('/register', async (req, reply) => {
  try {
    const { email, password, name } = req.body as any;
    const result = await ssoClient.register(email, password, name, getDeviceContext(req));
    return result;
  } catch (error: any) {
    reply.code(400).send({ error: error.message });
  }
});

app.post('/logout', async (req, reply) => {
  try {
    await ssoClient.logout(getDeviceContext(req));
    await req.session.destroy();
    return { message: 'Logged out successfully' };
  } catch (error: any) {
    reply.code(500).send({ error: error.message });
  }
});

app.get('/profile', async (req, reply) => {
  try {
    if (!ssoClient.isAuthenticated()) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
    const user = await ssoClient.getProfile(getDeviceContext(req));
    return user;
  } catch (error: any) {
    reply.code(401).send({ error: error.message });
  }
});

const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3000 });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
