import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Client } from 'pg';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/auth/password.js';
import { createDatabase } from '../../src/db.js';

test('PostgreSQL migrations, runtime restrictions and multi-tenant authentication', {
  skip: !process.env.TEST_DATABASE_URL,
}, async (t) => {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/quickfact_test') {
    throw new Error('Integration tests only run against the disposable quickfact_test database on loopback.');
  }
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quickfact_test_runtime') THEN
      CREATE ROLE quickfact_test_runtime LOGIN PASSWORD 'ephemeral-runtime-test-only' NOSUPERUSER NOBYPASSRLS;
    END IF;
  END $$;
  GRANT USAGE ON SCHEMA public TO quickfact_test_runtime;
  GRANT SELECT ON "Company", "User", "AnnualPeriod" TO quickfact_test_runtime;
  GRANT INSERT ON "AnnualPeriod" TO quickfact_test_runtime;
  GRANT SELECT, INSERT, DELETE ON "Session" TO quickfact_test_runtime;
  GRANT EXECUTE ON FUNCTION public.quickfact_login_user(text), public.quickfact_session(text) TO quickfact_test_runtime;`);
  const runtimeUrl = new URL(url);
  runtimeUrl.username = 'quickfact_test_runtime';
  runtimeUrl.password = 'ephemeral-runtime-test-only';
  const raw = new Client({ connectionString: runtimeUrl.toString() });
  await raw.connect();
  const database = createDatabase(runtimeUrl.toString());
  const elevated = createDatabase(url.toString());
  const companyA = randomUUID();
  const companyB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const owner = randomUUID();
  const username = `admin_${userA.replaceAll('-', '')}`;
  const ownerName = `owner_${owner.replaceAll('-', '')}`;
  const password = 'Disposable-integration-password';
  const passwordHash = await hashPassword(password);

  try {
    for (const [id, ruc] of [[companyA, '0000000000001'], [companyB, '0000000000002']]) {
      await admin.query('INSERT INTO "Company" ("id", "ruc", "legalName", "updatedAt") VALUES ($1,$2,$3,now())',
        [id, ruc, `Synthetic ${id}`]);
    }
    for (const [id, companyId, name, role] of [[userA, companyA, username, 'COMPANY_ADMIN'],
      [userB, companyB, `admin_${userB.replaceAll('-', '')}`, 'COMPANY_ADMIN'], [owner, null, ownerName, 'OWNER']]) {
      await admin.query(`INSERT INTO "User" ("id", "companyId", "username", "passwordHash", "firstName", "lastName", "role", "updatedAt")
        VALUES ($1,$2,$3,$4,'Synthetic','Test',$5,now())`, [id, companyId, name, passwordHash, role]);
    }
    await admin.query(`INSERT INTO "AnnualPeriod" ("id", "companyId", "startsAt", "endsAt") VALUES ($1,$2,'2026-01-01','2027-01-01')`,
      [randomUUID(), companyA]);

    await t.test('readiness accepts the limited runtime role and rejects superuser/migration credentials', async () => {
      assert.equal(await database.ready(), true);
      assert.equal(await elevated.ready(), false);
    });

    await t.test('RLS denies unscoped reads even with table privileges', async () => {
      for (const table of ['Company', 'User', 'AnnualPeriod', 'Session']) {
        assert.equal((await raw.query(`SELECT * FROM "${table}"`)).rowCount, 0);
      }
      await raw.query('SELECT * FROM public.quickfact_login_user($1)', [username]);
      assert.equal((await raw.query('SELECT * FROM "Company"')).rowCount, 0);
    });

    await t.test('tenant context permits only its rows and resets after the transaction', async () => {
      await raw.query('BEGIN');
      await raw.query(`SELECT set_config('quickfact.company_id',$1,true), set_config('quickfact.user_id',$2,true)`, [companyA, userA]);
      const companies = await raw.query('SELECT "id" FROM "Company"');
      assert.deepEqual(companies.rows.map((row) => row.id), [companyA]);
      const users = await raw.query('SELECT "id" FROM "User"');
      assert.deepEqual(users.rows.map((row) => row.id), [userA]);
      await assert.rejects(raw.query(`INSERT INTO "AnnualPeriod" ("id", "companyId", "startsAt", "endsAt")
        VALUES ($1,$2,'2028-01-01','2029-01-01')`, [randomUUID(), companyB]), (error: { code: string }) => error.code === '42501');
      await raw.query('ROLLBACK');
      assert.equal((await raw.query('SELECT * FROM "Company"')).rowCount, 0);
    });

    await t.test('database prevents wrong role/company combinations and overlapping periods', async () => {
      await assert.rejects(admin.query(`INSERT INTO "User" ("id", "companyId", "username", "passwordHash", "firstName", "lastName", "role", "updatedAt")
        VALUES ($1,$2,$3,$4,'Bad','Scope','OWNER',now())`, [randomUUID(), companyA, 'invalid_owner', passwordHash]),
        (error: { code: string }) => error.code === '23514');
      await assert.rejects(admin.query(`INSERT INTO "AnnualPeriod" ("id", "companyId", "startsAt", "endsAt")
        VALUES ($1,$2,'2026-02-01','2027-02-01')`, [randomUUID(), companyA]),
        (error: { code: string }) => error.code === '23P01');
    });

    const origin = 'http://localhost:3000';
    const app = createApp(origin, { authStore: database.store, ready: database.ready });
    const agent = request.agent(app);
    await t.test('real login persists a session and rejects cross-company HTTP reads', async () => {
      await agent.post('/auth/login').set('Origin', origin).send({ username, password }).expect(200);
      await agent.get('/auth/me').expect(200);
      await agent.get(`/companies/${companyA}`).expect(200);
      await agent.get(`/companies/${companyB}`).expect(403);
      assert.equal((await admin.query('SELECT count(*)::int AS total FROM "Session" WHERE "userId" = $1', [userA])).rows[0].total, 1);
    });

    await t.test('database role changes invalidate existing sessions', async () => {
      await admin.query('UPDATE "User" SET "role" = $1 WHERE "id" = $2', ['ADDITIONAL', userA]);
      await agent.get('/auth/me').expect(401);
    });

    await t.test('Owner can consult each company with platform authorization', async () => {
      const ownerAgent = request.agent(app);
      await ownerAgent.post('/auth/login').set('Origin', origin).send({ username: ownerName, password }).expect(200);
      await ownerAgent.get(`/companies/${companyA}`).expect(200);
      await ownerAgent.get(`/companies/${companyB}`).expect(200);
      await ownerAgent.post('/auth/logout').set('Origin', origin).expect(204);
      await ownerAgent.get('/auth/me').expect(401);
    });
  } finally {
    await Promise.all([database.close(), elevated.close(), raw.end()]);
    await admin.query('DELETE FROM "Session" WHERE "userId" = ANY($1::uuid[])', [[userA, userB, owner]]);
    await admin.query('DELETE FROM "User" WHERE "id" = ANY($1::uuid[])', [[userA, userB, owner]]);
    await admin.query('DELETE FROM "AnnualPeriod" WHERE "companyId" = ANY($1::uuid[])', [[companyA, companyB]]);
    await admin.query('DELETE FROM "Company" WHERE "id" = ANY($1::uuid[])', [[companyA, companyB]]);
    await admin.end();
  }
});
