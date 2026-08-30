import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// הסקריפט רץ מול החיבור הישיר (כמו המיגרציות) ולא מול ה-Transaction Pooler.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * העובדים הראשוניים של המשרד. ההתחברות עצמה מנוהלת ב-Supabase Auth - כאן
 * נוצרות רק רשומות העובדים לצורך שיוך משימות והרשאות. הקישור הוא לפי מייל,
 * ולכן חובה שהמיילים כאן יהיו זהים לאלו שמוגדרים ב-Supabase Auth.
 */
const users = [
  { name: "רו״ח שני שומן", email: "shani@cpa-rs.co.il", phone: "052-4317234", role: "PARTNER" as const },
  { name: "רו״ח רעות סרנגה", email: "reut@cpa-rs.co.il", phone: "054-6789887", role: "PARTNER" as const },
];

async function main() {
  for (const user of users) {
    // upsert כדי שניתן יהיה להריץ את הסקריפט שוב בלי ליצור כפילויות
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, phone: user.phone, role: user.role },
      create: user,
    });
    console.log(`✓ ${saved.name} (${saved.email}) — ${saved.role}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
