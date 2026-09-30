import 'dotenv/config';
import { createApp } from './app.js';
import { readConfig } from './config.js';

const config = readConfig(process.env);
const server = createApp(config.WEB_ORIGIN).listen(config.PORT, '0.0.0.0', () => {
  console.info(`QuickFact API listening on port ${config.PORT}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
