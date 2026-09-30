import 'dotenv/config';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createDatabase } from './db.js';

const config = readConfig(process.env);
const database = config.DATABASE_URL ? createDatabase(config.DATABASE_URL) : undefined;
if (database && !await database.ready()) {
  throw new Error('PostgreSQL no está listo: revisar conexión, migraciones y rol runtime limitado.');
}
const server = createApp(config.WEB_ORIGIN, {
  authStore: database?.store, ready: database?.ready,
  production: config.NODE_ENV === 'production', trustProxyHops: config.TRUST_PROXY_HOPS,
}).listen(config.PORT, '0.0.0.0', () => {
  console.info(`QuickFact API listening on port ${config.PORT}`);
});

let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(() => { void (database?.close() ?? Promise.resolve()).then(() => process.exit(0), () => process.exit(1)); });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
