import { createHash, randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { DUMMY_PASSWORD_HASH, HashCapacityError, verifyPassword } from './password.js';
import { canAccessCompany, publicUser, type AuthStore } from './types.js';

const SESSION_MS = 8 * 60 * 60 * 1000;
const loginInput = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256) }).strict();
export const normalizeUsername = (username: string) => username.normalize('NFKC').trim().toLowerCase();
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function createAuthRouter(store: AuthStore, webOrigin: string, production: boolean) {
  const router = Router();
  const cookieName = production ? '__Host-quickfact_session' : 'quickfact_session';
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax' as const, path: '/' };

  function requestToken(req: Request) {
    const values = (req.headers.cookie ?? '').split(';').map((value) => value.trim());
    const tokens = values.filter((value) => value.startsWith(`${cookieName}=`)).map((value) => value.slice(cookieName.length + 1));
    return tokens.length === 1 && /^[a-f0-9]{64}$/.test(tokens[0]!) ? tokens[0]! : null;
  }

  async function authenticate(req: Request) {
    const token = requestToken(req);
    if (!token) return null;
    const found = await store.findSession(tokenHash(token));
    if (!found || found.session.expiresAt <= new Date()
      || found.session.authVersion !== found.user.authVersion || !found.user.active
      || found.user.role === 'OWNER' && found.user.companyId !== null
      || found.user.role !== 'OWNER' && (!found.user.companyId || !found.user.companyActive)) return null;
    return found.user;
  }

  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use((req, res, next) => {
    // Browser requests pass through the web's /api proxy; check exact Origin too.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.headers.origin !== webOrigin) {
      res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
      return;
    }
    next();
  });

  router.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'TOO_MANY_LOGIN_ATTEMPTS' },
  }), async (req, res) => {
    const parsed = loginInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'INVALID_LOGIN_INPUT' }); return; }
    const user = await store.findUserByUsername(normalizeUsername(parsed.data.username));
    let matches: boolean;
    try { matches = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH); }
    catch (error) {
      if (error instanceof HashCapacityError) { res.status(429).json({ error: 'LOGIN_BUSY' }); return; }
      throw error;
    }
    if (!matches || !user || !user.active || user.role !== 'OWNER' && (!user.companyId || !user.companyActive)
      || user.role === 'OWNER' && user.companyId !== null) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS' }); return;
    }
    const oldToken = requestToken(req);
    if (oldToken) await store.deleteSession(tokenHash(oldToken));
    const token = randomBytes(32).toString('hex');
    await store.createSession({ tokenHash: tokenHash(token), userId: user.id,
      authVersion: user.authVersion, expiresAt: new Date(Date.now() + SESSION_MS) });
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: SESSION_MS });
    res.json({ user: publicUser(user) });
  });

  router.get('/auth/me', async (req, res) => {
    const user = await authenticate(req);
    if (!user) { res.status(401).json({ error: 'UNAUTHENTICATED' }); return; }
    res.json({ user: publicUser(user) });
  });

  router.post('/auth/logout', async (req, res) => {
    const token = requestToken(req);
    if (token) await store.deleteSession(tokenHash(token));
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  });

  router.get('/companies/:companyId', async (req, res) => {
    const user = await authenticate(req);
    if (!user) { res.status(401).json({ error: 'UNAUTHENTICATED' }); return; }
    const companyId = req.params.companyId as string;
    if (!z.string().uuid().safeParse(companyId).success) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (!canAccessCompany(user, companyId)) { res.status(403).json({ error: 'FORBIDDEN' }); return; }
    const company = await store.getCompany(user, companyId);
    if (!company) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json({ company });
  });
  return router;
}
