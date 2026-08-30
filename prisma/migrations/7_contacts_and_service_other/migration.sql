-- הוספת "ראיית חשבון בלבד" לסוגי השירות
ALTER TYPE "ServiceType" ADD VALUE 'ACCOUNTING_ONLY';

-- פירוט חופשי כשסוג השירות הוא "אחר"
ALTER TABLE "clients" ADD COLUMN "serviceTypeOther" TEXT;

-- טבלת אנשי הקשר של הלקוח
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_contacts_clientId_idx" ON "client_contacts"("clientId");

ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- העברת פרטי הקשר הקיימים לאיש קשר ראשי, לפני מחיקת העמודות הישנות.
-- מבוצע רק ללקוחות שיש להם לפחות פרט קשר אחד, כדי לא ליצור רשומות ריקות.
INSERT INTO "client_contacts" ("id", "clientId", "name", "phone", "email", "whatsapp", "isPrimary", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  "id",
  COALESCE(NULLIF(TRIM("contactName"), ''), 'איש קשר'),
  "phone",
  "email",
  "whatsapp",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "clients"
WHERE COALESCE(NULLIF(TRIM("contactName"), ''), NULLIF(TRIM("phone"), ''), NULLIF(TRIM("email"), ''), NULLIF(TRIM("whatsapp"), '')) IS NOT NULL;

-- מחיקת העמודות הישנות רק אחרי שהמידע הועבר
ALTER TABLE "clients"
  DROP COLUMN "contactName",
  DROP COLUMN "email",
  DROP COLUMN "phone",
  DROP COLUMN "whatsapp";
