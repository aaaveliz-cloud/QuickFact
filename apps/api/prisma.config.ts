import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Migraciones usan un rol separado del rol limitado de la aplicación.
  datasource: { url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL },
});
