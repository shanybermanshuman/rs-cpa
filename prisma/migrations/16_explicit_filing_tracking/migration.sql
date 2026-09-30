-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "tracksIncomeTaxAdvance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tracksNationalInsurance" BOOLEAN NOT NULL DEFAULT false;
