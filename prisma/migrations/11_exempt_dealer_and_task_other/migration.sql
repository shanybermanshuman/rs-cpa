-- AlterEnum
ALTER TYPE "ClientType" ADD VALUE 'EXEMPT_DEALER';

-- AlterTable
ALTER TABLE "client_tasks" ADD COLUMN     "taskTypeOther" TEXT;
