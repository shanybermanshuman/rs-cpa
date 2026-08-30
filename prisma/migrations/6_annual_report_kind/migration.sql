-- CreateEnum
CREATE TYPE "AnnualReportKind" AS ENUM ('COMPANY_AUDITED', 'INDIVIDUAL');

-- DropIndex
DROP INDEX "annual_extensions_taxYear_name_key";

-- AlterTable
ALTER TABLE "annual_extensions" ADD COLUMN     "kind" "AnnualReportKind" NOT NULL DEFAULT 'INDIVIDUAL';

-- CreateIndex
CREATE UNIQUE INDEX "annual_extensions_taxYear_kind_name_key" ON "annual_extensions"("taxYear", "kind", "name");
