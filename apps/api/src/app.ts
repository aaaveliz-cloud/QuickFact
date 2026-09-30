import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

export function createApp(webOrigin: string) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: webOrigin }));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'quickfact-api' });
  });
  app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(express.json({ limit: '100kb' }));
  // No exponer datos de empresas hasta implementar autenticación y autorización.
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
