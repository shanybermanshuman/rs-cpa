-- AlterEnum
BEGIN;
CREATE TYPE "ClientType_new" AS ENUM ('COMPANY', 'SELF_EMPLOYED', 'CONTROLLING_SHAREHOLDER');
ALTER TABLE "clients" ALTER COLUMN "clientType" TYPE "ClientType_new" USING ("clientType"::text::"ClientType_new");
ALTER TYPE "ClientType" RENAME TO "ClientType_old";
ALTER TYPE "ClientType_new" RENAME TO "ClientType";
DROP TYPE "public"."ClientType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ServiceType_new" AS ENUM ('FULL', 'BOOKKEEPING', 'SELF_EMPLOYED_PACKAGE', 'OTHER');
ALTER TABLE "clients" ALTER COLUMN "serviceType" TYPE "ServiceType_new" USING ("serviceType"::text::"ServiceType_new");
ALTER TYPE "ServiceType" RENAME TO "ServiceType_old";
ALTER TYPE "ServiceType_new" RENAME TO "ServiceType";
DROP TYPE "public"."ServiceType_old";
COMMIT;
