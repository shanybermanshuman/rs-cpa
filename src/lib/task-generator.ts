import { prisma } from "@/lib/prisma";
import { defaultRulesForClient, dueDatesInRange } from "@/lib/recurrence";
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

  const { count } = await prisma.clientTask.createMany({
    data: rows,
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
 * מוסיף רק כללים שחסרים (לפי סוג המשימה) ולעולם אינו דורס או מוחק כללים
 * קיימים. כך, לקוח שיובא ללא תדירות מע"מ ושהתדירות הושלמה לו מאוחר יותר,
 * יקבל את כלל המע"מ שלו בעדכון הבא - בלי לשכפל את שאר הכללים.
 */
export async function syncDefaultRulesForClient(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      clientType: true,
      serviceType: true,
      vatFrequency: true,
      hasEmployees: true,
    },
  });

  if (!client) return;

  const existing = await prisma.recurrenceRule.findMany({
    where: { clientId },
    select: { taskType: true },
  });
  const existingTypes = new Set(existing.map((r) => r.taskType));

  const missing = defaultRulesForClient(client).filter(
    (rule) => !existingTypes.has(rule.taskType),
  );

  if (missing.length > 0) {
    await prisma.recurrenceRule.createMany({
      data: missing.map((rule) => ({ ...rule, clientId })),
    });
  }

  await generateRecurringTasks(DEFAULT_HORIZON_MONTHS, clientId);
}
