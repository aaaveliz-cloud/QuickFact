import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createAuthRouter } from './auth/routes.js';
import type { AuthStore } from './auth/types.js';

export function createApp(webOrigin: string, options: {
  authStore?: AuthStore;
  production?: boolean;
  trustProxyHops?: number;
  ready?: () => Promise<boolean>;
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', options.trustProxyHops ?? 0);
  app.use(helmet());
  app.use(cors({ origin: webOrigin, credentials: true }));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'quickfact-api' });
  });
  app.get('/ready', async (_req, res) => {
    const ready = await options.ready?.() ?? false;
    res.setHeader('Cache-Control', 'no-store');
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  });
  app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(express.json({ limit: '100kb' }));
  if (options.authStore) app.use(createAuthRouter(options.authStore, webOrigin, options.production ?? false));
  else app.use('/auth', (_req, res) => { res.status(503).json({ error: 'AUTH_NOT_CONFIGURED' }); });
  app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status) : 500;
    res.status(status === 400 || status === 413 ? status : 500).json({
      error: status === 400 ? 'INVALID_JSON' : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
    });
  });
  return app;
}
