-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "withholdingFileNumber" TEXT,
ADD COLUMN     "withholdingRate" DECIMAL(5,2),
ADD COLUMN     "withholdingValidUntil" TIMESTAMP(3);
