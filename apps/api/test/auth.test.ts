import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth/password.js';
import { tokenHash } from '../src/auth/routes.js';
import { canAccessCompany, type AuthStore, type AuthUser, type CompanyProfile, type StoredSession } from '../src/auth/types.js';

const origin = 'http://localhost:3000';
const password = 'Synthetic-test-password-only';
const passwordHash = await hashPassword(password);

function fixture(production = false) {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const user: AuthUser = { id: randomUUID(), username: 'admin_a', firstName: 'Test', lastName: 'Admin',
    role: 'COMPANY_ADMIN', companyId: companyA, active: true, companyActive: true, passwordHash, authVersion: 1 };
  const owner: AuthUser = { ...user, id: randomUUID(), username: 'owner_test', role: 'OWNER', companyId: null };
  const users = [user, owner];
  const sessions = new Map<string, StoredSession>();
  const companies: CompanyProfile[] = [companyA, companyB].map((id, i) => ({ id, ruc: `000000000000${i}`,
    legalName: `Synthetic Company ${i}`, tradeName: null, active: true }));
  const store: AuthStore = {
    async findUserByUsername(username) { return users.find((item) => item.username === username) ?? null; },
    async findSession(hash) {
      const session = sessions.get(hash);
      const found = users.find((item) => item.id === session?.userId);
      return session && found ? { session, user: found } : null;
    },
    async createSession(session) { sessions.set(session.tokenHash, session); },
    async deleteSession(hash) { sessions.delete(hash); },
    async getCompany(actor, id) {
      return canAccessCompany(actor, id) ? companies.find((item) => item.id === id) ?? null : null;
    },
  };
  const app = createApp(origin, { authStore: store, production });
  return { app, user, owner, sessions, companyA, companyB };
}

test('username login establishes a revocable session without exposing secrets', async () => {
  const { app, sessions } = fixture();
  const agent = request.agent(app);
  const response = await agent.post('/auth/login').set('Origin', origin).send({ username: ' ADMIN_A ', password });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.username, 'admin_a');
  assert.ok(!JSON.stringify(response.body).includes(passwordHash));
  const cookie = (response.headers['set-cookie'] as unknown as string[])[0]!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const token = cookie.split(';')[0]!.split('=')[1]!;
  assert.ok(sessions.has(tokenHash(token)));
  assert.ok(!sessions.has(token));
  assert.equal((await agent.get('/auth/me')).status, 200);
  assert.equal((await agent.post('/auth/logout').set('Origin', origin)).status, 204);
  assert.equal((await agent.get('/auth/me')).status, 401);
  assert.equal(sessions.size, 0);
});

test('a company user cannot read a different company by changing the URL', async () => {
  const { app, companyA, companyB } = fixture();
  const agent = request.agent(app);
  await agent.post('/auth/login').set('Origin', origin).send({ username: 'admin_a', password }).expect(200);
  const own = await agent.get(`/companies/${companyA}`).expect(200);
  assert.equal(own.body.company.id, companyA);
  const other = await agent.get(`/companies/${companyB}`).expect(403);
  assert.deepEqual(other.body, { error: 'FORBIDDEN' });
  await request(app).get(`/companies/${companyA}`).expect(401);
});

test('Owner retains authorized global access without a fictitious company', async () => {
  const { app, companyA, companyB } = fixture();
  const agent = request.agent(app);
  await agent.post('/auth/login').set('Origin', origin).send({ username: 'owner_test', password }).expect(200);
  await agent.get(`/companies/${companyA}`).expect(200);
  await agent.get(`/companies/${companyB}`).expect(200);
});

test('unknown username, wrong password and disabled account share the same error', async () => {
  const { app, user } = fixture();
  for (const input of [{ username: 'missing', password }, { username: 'admin_a', password: 'wrong' }]) {
    const response = await request(app).post('/auth/login').set('Origin', origin).send(input).expect(401);
    assert.deepEqual(response.body, { error: 'INVALID_CREDENTIALS' });
  }
  user.active = false;
  await request(app).post('/auth/login').set('Origin', origin).send({ username: 'admin_a', password }).expect(401);
});

test('existing sessions stop working on user/company deactivation or auth version change', async () => {
  const { app, user, sessions } = fixture();
  const agent = request.agent(app);
  await agent.post('/auth/login').set('Origin', origin).send({ username: 'admin_a', password }).expect(200);
  user.active = false;
  await agent.get('/auth/me').expect(401);
  user.active = true;
  user.companyActive = false;
  await agent.get('/auth/me').expect(401);
  user.companyActive = true;
  user.authVersion++;
  await agent.get('/auth/me').expect(401);
  user.authVersion--;
  for (const session of sessions.values()) session.expiresAt = new Date(0);
  await agent.get('/auth/me').expect(401);
});

test('cross-origin mutations and client-assigned roles/companies are rejected', async () => {
  const { app, companyB } = fixture();
  await request(app).post('/auth/login').send({ username: 'admin_a', password }).expect(403);
  await request(app).post('/auth/logout').set('Origin', 'https://untrusted.example').expect(403);
  await request(app).post('/auth/login').set('Origin', origin)
    .send({ username: 'admin_a', password, role: 'OWNER', companyId: companyB }).expect(400);
});

test('production cookies are host-only, Secure and HttpOnly; private responses are not cached', async () => {
  const { app } = fixture(true);
  const response = await request(app).post('/auth/login').set('Origin', origin)
    .send({ username: 'admin_a', password }).expect(200);
  const cookie = (response.headers['set-cookie'] as unknown as string[])[0]!;
  assert.match(cookie, /^__Host-quickfact_session=/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /HttpOnly/);
  assert.ok(!cookie.includes('Domain='));
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('login rate limiting blocks repeated attempts independently of input validity', async () => {
  const { app } = fixture();
  for (let i = 0; i < 10; i++) await request(app).post('/auth/login').set('Origin', origin).send({}).expect(400);
  const response = await request(app).post('/auth/login').set('Origin', origin).send({}).expect(429);
  assert.deepEqual(response.body, { error: 'TOO_MANY_LOGIN_ATTEMPTS' });
});

test('password hashes use per-password salts and never contain the plaintext', async () => {
  const secondHash = await hashPassword(password);
  assert.notEqual(secondHash, passwordHash);
  assert.ok(!passwordHash.includes(password));
  assert.match(passwordHash, /^scrypt\$131072\$8\$1\$/);
});

test('unconfigured services report unavailable readiness and authentication', async () => {
  const app = createApp(origin);
  await request(app).get('/health').expect(200);
  await request(app).get('/ready').expect(503);
  await request(app).get('/auth/me').expect(503);
});
