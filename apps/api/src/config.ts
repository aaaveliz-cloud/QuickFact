import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
});

export function readConfig(env: NodeJS.ProcessEnv) {
  const config = schema.parse(env);
  const origin = new URL(config.WEB_ORIGIN);
  if (origin.origin !== config.WEB_ORIGIN) {
    throw new Error('WEB_ORIGIN debe ser un origen sin ruta ni barra final.');
  }
  if (config.NODE_ENV === 'production' && origin.protocol !== 'https:') {
    throw new Error('WEB_ORIGIN debe usar HTTPS en producción.');
  }
  if (config.DATABASE_URL && !/^postgres(?:ql)?:\/\//.test(config.DATABASE_URL)) {
    throw new Error('DATABASE_URL debe corresponder a PostgreSQL.');
  }
  if (config.NODE_ENV === 'production' && !config.DATABASE_URL) {
    throw new Error('DATABASE_URL es obligatoria en producción.');
  }
  return config;
}
