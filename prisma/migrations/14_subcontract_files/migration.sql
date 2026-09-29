-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('PROJECT', 'SUBCONTRACT');

-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'RECEIVED';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "fee" DECIMAL(10,2),
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "ProjectKind" NOT NULL DEFAULT 'PROJECT',
ADD COLUMN     "paidAt" TIMESTAMP(3);
