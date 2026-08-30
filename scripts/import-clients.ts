/**
 * ייבוא רשימת הלקוחות מגיליון האקסל של המשרד.
 *
 * ברירת המחדל היא הרצת "יבש" (dry run) שרק מדווחת מה יקרה, בלי לכתוב דבר.
 * לכתיבה בפועל יש להוסיף את הדגל --commit.
 *
 *   npx tsx scripts/import-clients.ts --file "שמות העמודות.xlsx"
 *   npx tsx scripts/import-clients.ts --file "שמות העמודות.xlsx" --commit
 *
 * דגלים נוספים:
 *   --status ACTIVE|ONBOARDING   סטטוס הלקוחות המיובאים (ברירת מחדל: ACTIVE)
 *   --sheet "<שם>"               גיליון ספציפי (ברירת מחדל: הראשון)
 *
 * הערה: תדירות דיווח המע"מ אינה קיימת בגיליון ולכן נשארת ריקה. עד שתושלם
 * ידנית בכרטיס הלקוח, לא ייווצרו לו משימות מע"מ (שאר המשימות כן ייווצרו).
 */
import "dotenv/config";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { ClientStatus, ClientType, ServiceType } from "../src/generated/prisma/client";
import { defaultRulesForClient, dueDatesInRange } from "../src/lib/recurrence";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

// --- מיפוי הערכים בעברית מהגיליון לערכי המערכת ---------------------------

const CLIENT_TYPE_MAP: Record<string, ClientType> = {
  "חברה": "COMPANY",
  "עצמאי": "SELF_EMPLOYED",
  "בעל שליטה": "CONTROLLING_SHAREHOLDER",
};

const SERVICE_TYPE_MAP: Record<string, ServiceType> = {
  "מלא": "FULL",
  "הנהלת חשבונות": "BOOKKEEPING",
  "הנהח": "BOOKKEEPING",
  "עצמאי": "SELF_EMPLOYED_PACKAGE",
  "אחר": "OTHER",
};

/** כותרות הגיליון, מנורמלות, אל שם השדה במערכת. */
const HEADER_MAP: Record<string, string> = {
  "שם הלקוח": "businessName",
  "חפ עמ תז": "taxId",
  "סוג לקוח": "clientType",
  "איש קשר": "contactName",
  "טלפון נייד": "phone",
  "מייל": "email",
  "סוג השירות": "serviceType",
};

/**
 * מנרמל טקסט לצורך השוואה: מסיר רווחים כפולים, סימני פיסוק וסוגריים.
 * כך "ח.פ / ע.מ /ת.ז" ו-"סוג לקוח (חברה, עצמאי, בעל שליטה)" מזוהים נכון.
 */
function normalize(value: unknown): string {
  return String(value ?? "")
    .replace(/\(.*?\)/g, " ") // "סוג לקוח (חברה, עצמאי...)" -> "סוג לקוח"
    .replace(/["'.]/g, "") // נקודות וגרשיים נמחקים: "ח.פ" -> "חפ"
    .replace(/[\-/,]/g, " ") // מפרידים הופכים לרווח
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  const value = cell?.value;
  if (value == null) return "";
  if (typeof value === "object") {
    if ("text" in value) return String(value.text).trim();
    if ("result" in value) return String(value.result ?? "").trim();
    if ("richText" in value)
      return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

// --- ניתוח הארגומנטים -----------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    file: get("--file") ?? "שמות העמודות.xlsx",
    sheet: get("--sheet"),
    status: (get("--status") ?? "ACTIVE") as ClientStatus,
    commit: args.includes("--commit"),
  };
}

type ParsedRow = {
  rowNumber: number;
  businessName: string;
  taxId: string | null;
  clientType: ClientType;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  serviceType: ServiceType;
};

async function main() {
  const opts = parseArgs();
  const filePath = path.resolve(process.cwd(), opts.file);

  console.log(`קובץ: ${filePath}`);
  console.log(opts.commit ? "מצב: כתיבה בפועל (--commit)\n" : "מצב: הרצה יבשה בלבד\n");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = opts.sheet ? workbook.getWorksheet(opts.sheet) : workbook.worksheets[0];
  if (!sheet) throw new Error(`הגיליון לא נמצא: ${opts.sheet ?? "(הראשון)"}`);

  // איתור שורת הכותרות - לא בהכרח השורה הראשונה
  let headerRow: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    if (headerRow) return;
    const texts = (row.values as unknown[]).map((v) => normalize(cellText({ value: v } as ExcelJS.Cell)));
    if (texts.some((t) => t === "שם הלקוח")) headerRow = row;
  });

  if (!headerRow) {
    throw new Error('לא נמצאה שורת כותרות המכילה "שם הלקוח".');
  }

  // מיפוי אינדקס עמודה -> שם שדה
  const columns = new Map<number, string>();
  headerRow.eachCell((cell, colNumber) => {
    const field = HEADER_MAP[normalize(cellText(cell))];
    if (field) columns.set(colNumber, field);
  });

  const missingHeaders = Object.values(HEADER_MAP).filter(
    (field) => ![...columns.values()].includes(field),
  );
  console.log(`שורת כותרות: ${headerRow.number}`);
  console.log(`עמודות שזוהו: ${columns.size}`);
  if (missingHeaders.length > 0) {
    console.log(`⚠ עמודות שלא נמצאו: ${missingHeaders.join(", ")}`);
  }
  console.log("");

  const rows: ParsedRow[] = [];
  const problems: string[] = [];

  sheet.eachRow((row) => {
    if (row.number <= headerRow!.number) return;

    const raw: Record<string, string> = {};
    columns.forEach((field, colNumber) => {
      raw[field] = cellText(row.getCell(colNumber));
    });

    if (!raw.businessName) return; // שורה ריקה

    const clientType = CLIENT_TYPE_MAP[normalize(raw.clientType)];
    if (!clientType) {
      problems.push(
        `שורה ${row.number} (${raw.businessName}): סוג לקוח לא מזוהה — "${raw.clientType}"`,
      );
      return;
    }

    const serviceType = SERVICE_TYPE_MAP[normalize(raw.serviceType)] ?? "OTHER";
    if (raw.serviceType && !SERVICE_TYPE_MAP[normalize(raw.serviceType)]) {
      problems.push(
        `שורה ${row.number} (${raw.businessName}): סוג שירות לא מזוהה — "${raw.serviceType}" — יסווג כ"אחר"`,
      );
    }

    rows.push({
      rowNumber: row.number,
      businessName: raw.businessName,
      taxId: raw.taxId || null,
      clientType,
      contactName: raw.contactName || null,
      phone: raw.phone || null,
      email: raw.email || null,
      serviceType,
    });
  });

  console.log(`שורות תקינות לייבוא: ${rows.length}`);
  if (problems.length > 0) {
    console.log(`\nבעיות (${problems.length}):`);
    problems.forEach((p) => console.log(`  ⚠ ${p}`));
  }

  // זיהוי כפילויות מול המסד ובתוך הקובץ עצמו
  const existing = await prisma.client.findMany({ select: { businessName: true, taxId: true } });
  const existingNames = new Set(existing.map((c) => c.businessName));
  const existingTaxIds = new Set(existing.map((c) => c.taxId).filter(Boolean));

  const seenNames = new Set<string>();
  const toCreate = rows.filter((row) => {
    if (existingNames.has(row.businessName) || seenNames.has(row.businessName)) {
      problems.push(`שורה ${row.rowNumber}: "${row.businessName}" כבר קיים — ידולג`);
      return false;
    }
    if (row.taxId && existingTaxIds.has(row.taxId)) {
      problems.push(`שורה ${row.rowNumber}: ח.פ ${row.taxId} כבר קיים — ידולג`);
      return false;
    }
    seenNames.add(row.businessName);
    return true;
  });

  console.log(`\nלקוחות שייווצרו: ${toCreate.length}`);
  toCreate.slice(0, 10).forEach((r) => {
    console.log(`  · ${r.businessName} — ${r.clientType} / ${r.serviceType}`);
  });
  if (toCreate.length > 10) console.log(`  ... ועוד ${toCreate.length - 10}`);

  if (!opts.commit) {
    console.log("\nהרצה יבשה — לא נכתב דבר. להרצה בפועל יש להוסיף --commit");
    return;
  }

  // --- כתיבה בפועל -------------------------------------------------------
  let created = 0;
  let tasksCreated = 0;
  const today = new Date();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  for (const row of toCreate) {
    const client = await prisma.client.create({
      data: {
        businessName: row.businessName,
        taxId: row.taxId,
        clientType: row.clientType,
        serviceType: row.serviceType,
        vatFrequency: null, // אינה קיימת בגיליון - להשלמה ידנית
        status: opts.status,
        // פרטי הקשר מהגיליון נכנסים כאיש הקשר הראשי
        ...(row.contactName || row.phone || row.email
          ? {
              contacts: {
                create: {
                  name: row.contactName ?? "איש קשר",
                  phone: row.phone,
                  email: row.email,
                  isPrimary: true,
                },
              },
            }
          : {}),
      },
    });
    created++;

    const rules = defaultRulesForClient(client);
    await prisma.recurrenceRule.createMany({
      data: rules.map((rule) => ({ ...rule, clientId: client.id })),
    });

    if (opts.status === "ACTIVE") {
      const saved = await prisma.recurrenceRule.findMany({ where: { clientId: client.id } });
      const taskRows = saved.flatMap((rule) =>
        dueDatesInRange(rule.frequency, rule.dayOfMonth, from, 3).map(
          ({ dueDate, periodLabel }) => ({
            clientId: client.id,
            recurrenceRuleId: rule.id,
            taskType: rule.taskType,
            dueDate,
            periodLabel,
          }),
        ),
      );
      const result = await prisma.clientTask.createMany({
        data: taskRows,
        skipDuplicates: true,
      });
      tasksCreated += result.count;
    }
  }

  console.log(`\n✓ נוצרו ${created} לקוחות ו-${tasksCreated} משימות.`);
  console.log("שימו לב: יש להשלים ידנית תדירות דיווח מע\"מ בכרטיס כל לקוח רלוונטי.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
