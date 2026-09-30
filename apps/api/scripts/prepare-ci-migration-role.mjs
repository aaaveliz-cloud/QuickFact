import pg from 'pg';

// Synthetic role in the disposable CI service only. Exercises migration without
// superuser permissions, as on managed PostgreSQL providers.
const url = new URL(process.env.TEST_DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/quickfact_test') {
  throw new Error('This setup only runs against the disposable loopback CI database.');
}
const client = new pg.Client({ connectionString: url.href });
await client.connect();
try {
  await client.query(`
    CREATE ROLE quickfact_test_migrator LOGIN PASSWORD 'ephemeral-migration-test-only' NOSUPERUSER NOBYPASSRLS;
    GRANT CREATE ON DATABASE quickfact_test TO quickfact_test_migrator;
    GRANT USAGE, CREATE ON SCHEMA public TO quickfact_test_migrator;
  `);
} finally {
  await client.end();
}
