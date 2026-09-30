import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma, type User } from './generated/prisma/client.js';
import { canAccessCompany, type AuthStore, type AuthUser, type StoredSession } from './auth/types.js';

export function createDatabase(connectionString: string) {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 5000 }) });

  async function context(tx: Prisma.TransactionClient, companyId: string | null, owner: boolean, userId: string) {
    // Transaction-local settings prevent tenant context leaking through the connection pool.
    await tx.$queryRaw`SELECT set_config('quickfact.company_id', ${companyId ?? ''}, true),
      set_config('quickfact.is_owner', ${owner ? 'true' : 'false'}, true),
      set_config('quickfact.user_id', ${userId}, true)`;
  }

  async function authUser(tx: Prisma.TransactionClient, user: User): Promise<AuthUser> {
    await context(tx, user.companyId, user.role === 'OWNER', user.id);
    const company = user.companyId ? await tx.company.findUnique({ where: { id: user.companyId }, select: { active: true } }) : null;
    return { ...user, companyActive: user.role === 'OWNER' || company?.active === true };
  }

  const store: AuthStore = {
    findUserByUsername: (username) => prisma.$transaction(async (tx) => {
      const [user] = await tx.$queryRaw<User[]>`SELECT * FROM public.quickfact_login_user(${username})`;
      return user ? authUser(tx, user) : null;
    }),
    findSession: (tokenHash) => prisma.$transaction(async (tx) => {
      const [found] = await tx.$queryRaw<(StoredSession & { userData: User })[]>`
        SELECT * FROM public.quickfact_session(${tokenHash})`;
      return found ? { session: found, user: await authUser(tx, found.userData) } : null;
    }),
    async createSession(session: StoredSession) {
      await prisma.$transaction(async (tx) => {
        await context(tx, null, false, session.userId);
        await tx.session.create({ data: session });
      });
    },
    async deleteSession(tokenHash) {
      await prisma.$transaction(async (tx) => {
        const [found] = await tx.$queryRaw<StoredSession[]>`SELECT * FROM public.quickfact_session(${tokenHash})`;
        if (!found) return;
        await context(tx, null, false, found.userId);
        await tx.session.deleteMany({ where: { tokenHash } });
      });
    },
    getCompany: (actor, companyId) => {
      if (!canAccessCompany(actor, companyId)) return Promise.resolve(null);
      return prisma.$transaction(async (tx) => {
        await context(tx, actor.companyId, actor.role === 'OWNER', actor.id);
        return tx.company.findUnique({ where: { id: companyId },
          select: { id: true, ruc: true, legalName: true, tradeName: true, active: true } });
      });
    },
  };

  return {
    store,
    async ready() {
      try {
        const roles = await prisma.$queryRaw<{ unsafe: boolean }[]>`
          SELECT (rolsuper OR rolbypassrls OR EXISTS (
            SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user
              AND tablename IN ('Company', 'User', 'AnnualPeriod', 'Session')
          )) AS unsafe FROM pg_roles WHERE rolname = current_user`;
        if (roles[0]?.unsafe !== false) return false;
        const [tables] = await prisma.$queryRaw<{ safe: boolean }[]>`
          SELECT (count(*) = 4 AND bool_and(relrowsecurity AND relforcerowsecurity)) AS safe
          FROM pg_class WHERE relnamespace = 'public'::regnamespace
            AND relname IN ('Company', 'User', 'AnnualPeriod', 'Session')`;
        if (tables?.safe !== true) return false;
        const [functions] = await prisma.$queryRaw<{ safe: boolean }[]>`
          SELECT has_function_privilege(current_user, 'public.quickfact_login_user(text)', 'EXECUTE')
            AND has_function_privilege(current_user, 'public.quickfact_session(text)', 'EXECUTE') AS safe`;
        if (functions?.safe !== true) return false;
        await prisma.$queryRaw`SELECT 1 FROM "Session" WHERE FALSE`;
        return true;
      } catch { return false; }
    },
    close: () => prisma.$disconnect(),
  };
}
