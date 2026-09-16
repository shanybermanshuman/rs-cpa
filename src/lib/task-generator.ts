import { prisma } from "@/lib/prisma";
import { defaultRulesForClient, dueDatesInRange } from "@/lib/recurrence";
import { startOfToday } from "@/lib/dates";
import type { TaskStatus } from "@/generated/prisma/client";

/** כמה חודשים קדימה נוצרות משימות שוטפות. */
export const DEFAULT_HORIZON_MONTHS = 3;

/**
 * הדוח השנתי נוצר שנה קדימה ולא שלושה חודשים: העבודה עליו נמשכת חודשים
 * ומתחילה הרבה לפני מועד ההגשה באפריל, ולכן הוא חייב להופיע במערכת כל השנה.
 */
const YEARLY_HORIZON_MONTHS = 14;

/**
 * הסטטוסים שנחשבים "פתוחים" - משימות שעדיין דורשות טיפול.
 * מקור אמת יחיד: משמש גם בסינון המסכים וגם בסימון משימות באיחור.
 */
export const OPEN_STATUSES: TaskStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "WAITING_ON_CLIENT",
  "OVERDUE",
];

export type GenerationResult = {
  createdCount: number;
  rulesProcessed: number;
};

/**
 * יוצר את המשימות החוזרות שטרם נוצרו, עבור כל כללי החזרה הפעילים.
 *
 * הפונקציה נועדה לרוץ שוב ושוב (יומית) - היא לעולם לא תיצור כפילויות, בזכות
 * האינדקס הייחודי על (recurrenceRuleId, dueDate) בסכמה.
 */
export async function generateRecurringTasks(
  horizonMonths = DEFAULT_HORIZON_MONTHS,
  clientId?: string,
): Promise<GenerationResult> {
  const rules = await prisma.recurrenceRule.findMany({
    where: {
      isActive: true,
      client: { status: "ACTIVE", ...(clientId ? { id: clientId } : {}) },
    },
    include: { client: { select: { ownerId: true } } },
  });

  const today = new Date();
  const from = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  const rows = rules.flatMap((rule) =>
    dueDatesInRange(
      rule.frequency,
      rule.dayOfMonth,
      from,
      rule.frequency === "YEARLY" ? YEARLY_HORIZON_MONTHS : horizonMonths,
    ).map(
      ({ dueDate, periodLabel }) => ({
        clientId: rule.clientId,
        recurrenceRuleId: rule.id,
        taskType: rule.taskType,
        dueDate,
        periodLabel,
        assigneeId: rule.client.ownerId,
      }),
    ),
  );

  if (rows.length === 0) return { createdCount: 0, rulesProcessed: rules.length };

  // מניעת שורה כפולה לאותו דיווח, גם כשהשורה הקיימת שייכת לכלל אחר. האינדקס
  // הייחודי מגן רק בתוך כלל אחד, ושני מקרים אמיתיים עוקפים אותו:
  //
  // 1. שינוי תדירות: הכלל הישן מבוטל, אך שורה עתידית שכבר סומנה כהוגשה
  //    נשמרת - והכלל החדש היה יוצר לצידה שורה פתוחה לאותו מועד. הלוח הציג
  //    רק אחת מהן, והשנייה הפכה להתראת איחור בלי תא שאפשר לסגור.
  // 2. דוח שנתי שהועבר לגל אורכות: שינוי מועד ההגשה מפנה את המועד המקורי,
  //    והכלל היה יוצר דוח שני לאותה שנת מס. לכן בדוח השנתי ההשוואה היא גם
  //    לפי תווית התקופה ("שנת 2026") ולא רק לפי המועד.
  //
  // בדיווחי הלוח רק שורה של כלל תופסת את המקום: משימה חד-פעמית מאותו סוג
  // אינה מוצגת בלוח, ואילו הייתה חוסמת, התקופה הייתה נעלמת ממנו. בדוח השנתי
  // גם משימה חד-פעמית תופסת מקום - מסך הדוחות השנתיים יוצר אותן כך בכוונה.
  const dueDates = rows.map((row) => row.dueDate.getTime());
  const annualLabels = [
    ...new Set(
      rows.filter((row) => row.taskType === "ANNUAL_REPORT").map((row) => row.periodLabel),
    ),
  ];

  const taken = await prisma.clientTask.findMany({
    where: {
      clientId: { in: [...new Set(rows.map((row) => row.clientId))] },
      OR: [
        {
          taskType: { in: [...new Set(rows.map((row) => row.taskType))] },
          dueDate: {
            gte: new Date(Math.min(...dueDates)),
            lte: new Date(Math.max(...dueDates)),
          },
        },
        ...(annualLabels.length > 0
          ? [{ taskType: "ANNUAL_REPORT" as const, periodLabel: { in: annualLabels } }]
          : []),
      ],
    },
    select: {
      clientId: true,
      taskType: true,
      dueDate: true,
      periodLabel: true,
      recurrenceRuleId: true,
    },
  });

  const slot = (r: { clientId: string; taskType: string; dueDate: Date }) =>
    `${r.clientId}|${r.taskType}|${r.dueDate.getTime()}`;
  const annualSlot = (r: { clientId: string; periodLabel: string | null }) =>
    `${r.clientId}|${r.periodLabel}`;

  const takenSlots = new Set<string>();
  const takenAnnual = new Set<string>();
  for (const task of taken) {
    if (task.taskType === "ANNUAL_REPORT") {
      takenSlots.add(slot(task));
      if (task.periodLabel) takenAnnual.add(annualSlot(task));
    } else if (task.recurrenceRuleId !== null) {
      takenSlots.add(slot(task));
    }
  }

  const fresh = rows.filter(
    (row) =>
      !takenSlots.has(slot(row)) &&
      !(row.taskType === "ANNUAL_REPORT" && takenAnnual.has(annualSlot(row))),
  );

  if (fresh.length === 0) return { createdCount: 0, rulesProcessed: rules.length };

  const { count } = await prisma.clientTask.createMany({
    data: fresh,
    skipDuplicates: true,
  });

  return { createdCount: count, rulesProcessed: rules.length };
}

/**
 * מסמן כ"באיחור" משימות שמועד ההגשה שלהן חלף וטרם הוגשו.
 * רץ יחד עם יצירת המשימות, כדי שלוח הבקרה יציג תמונת מצב נכונה.
 */
export async function markOverdueTasks(): Promise<number> {
  const today = new Date();
  const startOfToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  const { count } = await prisma.clientTask.updateMany({
    where: {
      dueDate: { lt: startOfToday },
      // OVERDUE עצמו לא נכלל - הוא כבר מסומן
      status: { in: ["NOT_STARTED", "IN_PROGRESS", "WAITING_ON_CLIENT"] },
    },
    data: { status: "OVERDUE" },
  });

  return count;
}

/**
 * מסנכרן ללקוח את סט כללי החזרה הסטטוטוריים המתאים לו, ומיד גם את המשימות
 * הראשונות - כדי שלקוח חדש לא "ייפול בין הכיסאות" עד ריצת ה-cron.
 *
 * מוסיף כללים שחסרים, **ומבטל כללים שחדלו להתאים** - למשל כשלקוח משתנה
 * לעוסק פטור, כשתדירות המע"מ נמחקת, או כשתדירות דיווח משתנה מחודשי
 * לדו-חודשי. כלל נחשב תואם רק אם גם הסוג, גם התדירות וגם יום ההגשה זהים:
 * השוואה לפי סוג בלבד הייתה משאירה לקוח שעבר לדו-חודשי עם הכלל החודשי.
 *
 * הביטול שמרני בכוונה: הכלל מסומן כלא-פעיל ולא נמחק, ונמחקות ממנו רק
 * משימות **עתידיות שטרם הוגשו**. כל מה שהוגש בעבר נשאר להיסטוריה.
 */
export async function syncDefaultRulesForClient(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      clientType: true,
      serviceType: true,
      vatFrequency: true,
      hasEmployees: true,
      withholdingFrequency: true,
    },
  });

  if (!client) return;

  const ruleKey = (r: { taskType: string; frequency: string; dayOfMonth: number }) =>
    `${r.taskType}|${r.frequency}|${r.dayOfMonth}`;

  const desired = defaultRulesForClient(client);
  const desiredKeys = new Set(desired.map(ruleKey));

  const existing = await prisma.recurrenceRule.findMany({
    where: { clientId, isActive: true },
    select: { id: true, taskType: true, frequency: true, dayOfMonth: true },
  });
  const existingKeys = new Set(existing.map(ruleKey));

  const missing = desired.filter((rule) => !existingKeys.has(ruleKey(rule)));
  if (missing.length > 0) {
    await prisma.recurrenceRule.createMany({
      data: missing.map((rule) => ({ ...rule, clientId })),
    });
  }

  const obsolete = existing.filter((rule) => !desiredKeys.has(ruleKey(rule)));
  if (obsolete.length > 0) {
    const ids = obsolete.map((rule) => rule.id);
    await prisma.$transaction([
      prisma.recurrenceRule.updateMany({
        where: { id: { in: ids } },
        data: { isActive: false },
      }),
      prisma.clientTask.deleteMany({
        where: {
          recurrenceRuleId: { in: ids },
          dueDate: { gte: startOfToday() },
          status: { in: OPEN_STATUSES },
        },
      }),
    ]);
  }

  await generateRecurringTasks(DEFAULT_HORIZON_MONTHS, clientId);
}
