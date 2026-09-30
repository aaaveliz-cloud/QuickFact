-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'COMPANY_ADMIN', 'ADDITIONAL');

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "ruc" VARCHAR(13) NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "authVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnualPeriod" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "startsAt" DATE NOT NULL,
    "endsAt" DATE NOT NULL,
    "documentLimit" INTEGER NOT NULL DEFAULT 15,
    "userLimit" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnualPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_ruc_key" ON "Company"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_companyId_active_idx" ON "User"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_id_key" ON "User"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AnnualPeriod_companyId_endsAt_idx" ON "AnnualPeriod"("companyId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualPeriod_companyId_startsAt_key" ON "AnnualPeriod"("companyId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualPeriod_companyId_id_key" ON "AnnualPeriod"("companyId", "id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualPeriod" ADD CONSTRAINT "AnnualPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants beyond Prisma's declarative schema.
ALTER TABLE "Company" ADD CONSTRAINT "Company_ruc_format" CHECK ("ruc" ~ '^[0-9]{13}$');
ALTER TABLE "User" ADD CONSTRAINT "User_role_scope" CHECK (
  ("role" = 'OWNER' AND "companyId" IS NULL) OR ("role" <> 'OWNER' AND "companyId" IS NOT NULL)
);
ALTER TABLE "User" ADD CONSTRAINT "User_username_normalized" CHECK (
  "username" = lower(btrim(normalize("username", NFKC))) AND length("username") BETWEEN 1 AND 64
);
ALTER TABLE "User" ADD CONSTRAINT "User_password_hash_format" CHECK (
  "passwordHash" ~ '^scrypt[$]131072[$]8[$]1[$][a-f0-9]{32}[$][a-f0-9]{128}$'
);
ALTER TABLE "User" ADD CONSTRAINT "User_auth_version_positive" CHECK ("authVersion" >= 1);
ALTER TABLE "Session" ADD CONSTRAINT "Session_hash_format" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "Session" ADD CONSTRAINT "Session_auth_version_positive" CHECK ("authVersion" >= 1);
ALTER TABLE "AnnualPeriod" ADD CONSTRAINT "AnnualPeriod_valid_dates" CHECK ("startsAt" < "endsAt");
ALTER TABLE "AnnualPeriod" ADD CONSTRAINT "AnnualPeriod_valid_limits" CHECK ("documentLimit" >= 0 AND "userLimit" >= 1);
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "AnnualPeriod" ADD CONSTRAINT "AnnualPeriod_no_overlap" EXCLUDE USING gist (
  "companyId" WITH =, daterange("startsAt", "endsAt", '[)') WITH &&
);

CREATE FUNCTION public.quickfact_bump_auth_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW."passwordHash" IS DISTINCT FROM OLD."passwordHash"
    OR NEW."role" IS DISTINCT FROM OLD."role"
    OR NEW."companyId" IS DISTINCT FROM OLD."companyId"
    OR NEW."active" IS DISTINCT FROM OLD."active" THEN
    NEW."authVersion" := OLD."authVersion" + 1;
  ELSIF NEW."authVersion" < OLD."authVersion" THEN
    RAISE EXCEPTION 'authVersion cannot decrease';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quickfact_user_security_change BEFORE UPDATE ON "User"
FOR EACH ROW EXECUTE FUNCTION public.quickfact_bump_auth_version();

-- All scopes are set only by backend services, LOCAL to one transaction.
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_scope ON "Company" USING (
  current_setting('quickfact.is_owner', true) = 'true'
  OR "id"::text = current_setting('quickfact.company_id', true)
) WITH CHECK (
  current_setting('quickfact.is_owner', true) = 'true'
  OR "id"::text = current_setting('quickfact.company_id', true)
);
ALTER TABLE "AnnualPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnnualPeriod" FORCE ROW LEVEL SECURITY;
CREATE POLICY period_scope ON "AnnualPeriod" USING (
  current_setting('quickfact.is_owner', true) = 'true'
  OR "companyId"::text = current_setting('quickfact.company_id', true)
) WITH CHECK (
  current_setting('quickfact.is_owner', true) = 'true'
  OR "companyId"::text = current_setting('quickfact.company_id', true)
);
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_scope ON "User" USING (
  current_setting('quickfact.is_owner', true) = 'true'
  OR "id"::text = current_setting('quickfact.user_id', true)
) WITH CHECK (
  current_setting('quickfact.is_owner', true) = 'true'
  OR "id"::text = current_setting('quickfact.user_id', true)
);
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;
CREATE POLICY session_scope ON "Session" USING (
  current_setting('quickfact.is_owner', true) = 'true'
  OR "userId"::text = current_setting('quickfact.user_id', true)
) WITH CHECK (
  current_setting('quickfact.is_owner', true) = 'true'
  OR "userId"::text = current_setting('quickfact.user_id', true)
);

-- Narrow platform identity lookups for login/session resolution. Function-local
-- GUCs restore automatically at exit; no arbitrary SQL or table name parameters.
CREATE FUNCTION public.quickfact_login_user(p_username text) RETURNS SETOF public."User"
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE previous_owner text := current_setting('quickfact.is_owner', true);
BEGIN
  PERFORM set_config('quickfact.is_owner', 'true', true);
  RETURN QUERY SELECT * FROM public."User" WHERE "username" = p_username;
  PERFORM set_config('quickfact.is_owner', coalesce(previous_owner, ''), true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('quickfact.is_owner', coalesce(previous_owner, ''), true);
  RAISE;
END;
$$;
CREATE FUNCTION public.quickfact_session(p_token_hash text)
RETURNS TABLE ("tokenHash" text, "userId" uuid, "authVersion" integer,
  "expiresAt" timestamp(3), "userData" jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE previous_owner text := current_setting('quickfact.is_owner', true);
BEGIN
  PERFORM set_config('quickfact.is_owner', 'true', true);
  RETURN QUERY SELECT s."tokenHash"::text, s."userId", s."authVersion", s."expiresAt", to_jsonb(u)
  FROM public."Session" s JOIN public."User" u ON u."id" = s."userId"
  WHERE s."tokenHash" = p_token_hash;
  PERFORM set_config('quickfact.is_owner', coalesce(previous_owner, ''), true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('quickfact.is_owner', coalesce(previous_owner, ''), true);
  RAISE;
END;
$$;
REVOKE ALL ON FUNCTION public.quickfact_login_user(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickfact_session(text) FROM PUBLIC;
