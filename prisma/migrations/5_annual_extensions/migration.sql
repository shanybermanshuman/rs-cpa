-- AlterTable
ALTER TABLE "client_tasks" ADD COLUMN     "annualExtensionId" TEXT;

-- CreateTable
CREATE TABLE "annual_extensions" (
    "id" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annual_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "annual_extensions_taxYear_name_key" ON "annual_extensions"("taxYear", "name");

-- AddForeignKey
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_annualExtensionId_fkey" FOREIGN KEY ("annualExtensionId") REFERENCES "annual_extensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
