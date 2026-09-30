-- CreateTable
CREATE TABLE "alert_snoozes" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_snoozes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alert_snoozes_alertId_key" ON "alert_snoozes"("alertId");

-- CreateIndex
CREATE INDEX "alert_snoozes_until_idx" ON "alert_snoozes"("until");

-- AddForeignKey
ALTER TABLE "alert_snoozes" ADD CONSTRAINT "alert_snoozes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
