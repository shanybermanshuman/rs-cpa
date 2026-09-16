import { prisma } from "@/lib/prisma";
import { OPEN_STATUSES } from "@/lib/task-generator";
import { startOfToday } from "@/lib/dates";
import { RECURRING_TASK_TYPES } from "@/lib/recurrence";
import type { ClientTaskType } from "@/generated/prisma/client";

/**
 * "מחזור דיווח" = כל המשימות מאותו סוג ולאותה תקופה, על פני כל הלקוחות.
 * למשל: "מע\"מ · ינואר 2026" של 80 לקוחות הוא מחזור אחד.
 *
 * זו יחידת העבודה האמיתית במשרד - ב-15 לחודש מגישים את המע"מ של כולם ברצף,
 * ולא עוברים משימה-משימה. התצוגה מתקבצת, אך הנתונים במסד נשארים ברמת הלקוח
 * כדי שכרטיס הלקוח והמעקב האישי ימשיכו לעבוד.
 */
export type FilingCycle = {
  key: string;
  taskType: ClientTaskType;
  periodLabel: string | null;
  dueDate: Date;
  total: number;
  done: number;
  overdue: boolean;
};

/** הדוח השנתי מנוהל במסך נפרד ולכן אינו נכלל במחזורים השוטפים. */
export const RECURRING_CYCLE_TYPES = RECURRING_TASK_TYPES;

export function cycleKey(taskType: string, periodLabel: string | null) {
  return `${taskType}::${periodLabel ?? ""}`;
}

export function parseCycleKey(key: string) {
  const [taskType, periodLabel] = key.split("::");
  return { taskType: taskType as ClientTaskType, periodLabel: periodLabel || null };
}

/**
 * מחזיר את מחזורי הדיווח השוטפים, מקובצים לפי סוג דיווח ותקופה.
 *
 * @param horizonDays כמה ימים קדימה לכלול. מחזורים באיחור נכללים תמיד.
 */
export async function getFilingCycles(horizonDays = 30): Promise<FilingCycle[]> {
  const today = startOfToday();
  const horizon = new Date(today.getTime() + horizonDays * 86_400_000);

  const grouped = await prisma.clientTask.groupBy({
    by: ["taskType", "periodLabel", "dueDate", "status"],
    where: {
      taskType: { in: RECURRING_CYCLE_TYPES },
      // רק משימות שנוצרו ע"י מנוע החזרה שייכות למחזור. משימה שנפתחה ידנית
      // היא משימה בודדת ומוצגת בנפרד - ראו getIndividualTasks.
      recurrenceRuleId: { not: null },
      client: { status: "ACTIVE" },
    },
    _count: { _all: true },
  });

  // איחוד לפי סוג+תקופה: מועד ההגשה עשוי להשתנות מעט בין לקוחות
  const byKey = new Map<string, FilingCycle>();

  for (const row of grouped) {
    const key = cycleKey(row.taskType, row.periodLabel);
    const existing = byKey.get(key);
    const isDone = !OPEN_STATUSES.includes(row.status);

    if (existing) {
      existing.total += row._count._all;
      if (isDone) existing.done += row._count._all;
      if (row.dueDate < existing.dueDate) existing.dueDate = row.dueDate;
    } else {
      byKey.set(key, {
        key,
        taskType: row.taskType,
        periodLabel: row.periodLabel,
        dueDate: row.dueDate,
        total: row._count._all,
        done: isDone ? row._count._all : 0,
        overdue: false,
      });
    }
  }

  return [...byKey.values()]
    .map((c) => ({ ...c, overdue: c.dueDate < today && c.done < c.total }))
    // מחזור שהושלם במלואו יורד מהמסך; מה שבאיחור נשאר תמיד
    .filter((c) => c.done < c.total && (c.overdue || c.dueDate <= horizon))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * משימות בודדות: כל מה שנפתח ידנית ואינו חלק ממחזור דיווח.
 *
 * אלה משימות שוטפות שצצות במהלך העבודה (הצהרת הון, בקשת אישור, טיפול חד-פעמי),
 * ויש הרבה כאלה. הן מוצגות ברמת המשימה הבודדת ולא מקובצות, כי לכל אחת הקשר
 * משלה. הדוח השנתי מוחרג - הוא מנוהל במסך ייעודי.
 */
export async function getIndividualTasks(limit = 50) {
  return prisma.clientTask.findMany({
    where: {
      recurrenceRuleId: null,
      taskType: { not: "ANNUAL_REPORT" },
      status: { in: OPEN_STATUSES },
      client: { status: "ACTIVE" },
    },
    include: { client: { select: { id: true, businessName: true } } },
    orderBy: { dueDate: "asc" },
    take: limit,
  });
}

/** מחזורים שמועדם רחוק מהטווח המוצג - לתצוגת "בהמשך". */
export async function getUpcomingCycleCount(horizonDays = 30): Promise<number> {
  const today = startOfToday();
  const horizon = new Date(today.getTime() + horizonDays * 86_400_000);

  const rows = await prisma.clientTask.groupBy({
    by: ["taskType", "periodLabel"],
    where: {
      taskType: { in: RECURRING_CYCLE_TYPES },
      client: { status: "ACTIVE" },
      status: { in: OPEN_STATUSES },
      dueDate: { gt: horizon },
    },
  });

  return rows.length;
}
