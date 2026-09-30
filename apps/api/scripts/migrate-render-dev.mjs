import { spawnSync } from 'node:child_process';
import pg from 'pg';

// This administrative task is restricted to the development database authorized
// by its dashboard URL. It never prints credentials or raw database errors.
const expectedHost = /^dpg-dauk5u49v7es739sqo20-a\.[a-z0-9-]+-postgres\.render\.com$/;
let client;
try {
  const connection = new URL(process.env.MIGRATION_DATABASE_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(connection.protocol)
      || !expectedHost.test(connection.hostname)
      || !connection.username || !connection.password
      || connection.pathname.length < 2) {
    throw new Error('INVALID_TARGET');
  }
  // Public external endpoint: require TLS and validate the server certificate.
  connection.searchParams.set('sslmode', 'verify-full');
  connection.searchParams.delete('sslcert');
  connection.searchParams.delete('sslkey');
  connection.searchParams.delete('sslrootcert');
  client = new pg.Client({ connectionString: connection.href, connectionTimeoutMillis: 15000 });
  await client.connect();
  console.log('Authorized Render development database connected over verified TLS.');
  if ((await client.query("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present")).rows[0].present) {
    const failed = await client.query('SELECT logs FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL');
    for (const record of failed.rows) {
      const log = record.logs ?? '';
      const codes = [...new Set(log.match(/\bP\d{4}\b|\bE[0-9A-Z]{5}\b/g) ?? [])];
      const hints = ['permission denied', 'btree_gist', 'already exists', 'does not exist', 'not supported', 'must be owner', 'superuser', 'syntax error'].filter(s => log.includes(s));
      console.error(`Existing failed migration: codes ${codes.join(', ') || 'none'}; known hints ${hints.join(', ') || 'none'}.`);
    }
  }
  const migration = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, MIGRATION_DATABASE_URL: connection.href },
    encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024,
  });
  if (migration.status !== 0) {
    const output = `${migration.stdout ?? ''}\n${migration.stderr ?? ''}`;
    const prismaCodes = [...new Set(output.match(/\bP\d{4}\b/g) ?? [])];
    const sqlCodes = [...output.matchAll(/(?:Database error code|SQLSTATE):\s*([A-Z0-9]{5})/g)].map(m => m[1]);
    console.error(`Migration diagnostic codes: ${[...prismaCodes, ...sqlCodes].join(', ') || 'none'}; process status: ${migration.status ?? 'unavailable'}.`);
    throw new Error('MIGRATION_FAILED');
  }
  const result = await client.query(`
    SELECT count(*)::int AS count FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('Company', 'User', 'AnnualPeriod', 'Session')
      AND c.relrowsecurity AND c.relforcerowsecurity
  `);
  if (result.rows[0].count !== 4) throw new Error('SCHEMA_CHECK_FAILED');
  const identity = await client.query(`
    SELECT count(*)::int AS count FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('quickfact_login_user', 'quickfact_session') AND p.prosecdef
  `);
  if (identity.rows[0].count !== 2) throw new Error('IDENTITY_CHECK_FAILED');
  console.log('Migration applied: four tables with forced RLS and two identity functions verified.');
} catch (error) {
  const safeCodes = new Set(['INVALID_TARGET', 'MIGRATION_FAILED', 'SCHEMA_CHECK_FAILED', 'IDENTITY_CHECK_FAILED']);
  const code = safeCodes.has(error?.message) ? error.message : 'CONNECTION_OR_VERIFICATION_FAILED';
  console.error(`Development database setup failed: ${code}. No credentials or raw database output were logged.`);
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
