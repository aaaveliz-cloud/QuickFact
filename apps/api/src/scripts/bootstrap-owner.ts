import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';
import { hashPassword } from '../auth/password.js';
import { normalizeUsername } from '../auth/routes.js';

async function main() {
  const input = z.object({
    MIGRATION_DATABASE_URL: z.string().min(1),
    OWNER_USERNAME: z.string().min(1),
    OWNER_PASSWORD: z.string().min(12).max(256),
    OWNER_FIRST_NAME: z.string().trim().min(1),
    OWNER_LAST_NAME: z.string().trim().min(1),
  }).parse(process.env);
  const username = normalizeUsername(input.OWNER_USERNAME);
  if (username.length === 0 || username.length > 64) throw new Error('INVALID_OWNER_USERNAME');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: input.MIGRATION_DATABASE_URL }) });
  try {
    const passwordHash = await hashPassword(input.OWNER_PASSWORD);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('quickfact.is_owner', 'true', true)`;
      // Serialize bootstrap; never overwrite an existing owner or reset a password.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(714029601)`;
      if (await tx.user.findFirst({ where: { role: 'OWNER' } })) throw new Error('OWNER_ALREADY_EXISTS');
      await tx.user.create({ data: { username, passwordHash, firstName: input.OWNER_FIRST_NAME,
        lastName: input.OWNER_LAST_NAME, role: 'OWNER', companyId: null } });
    });
    console.info('Owner inicial creado. Retirar OWNER_PASSWORD de las variables usadas para el bootstrap.');
  } finally { await prisma.$disconnect(); }
}

main().catch(() => {
  console.error('No se creó el Owner. Revisar variables privadas, migraciones y si ya existe un Owner.');
  process.exitCode = 1;
});
