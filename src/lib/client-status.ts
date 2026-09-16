import { prisma } from "@/lib/prisma";
import { OPEN_STATUSES } from "@/lib/task-generator";
import { startOfToday } from "@/lib/dates";
import { RECURRING_TASK_TYPES } from "@/lib/recurrence";
import type { ClientTask, ClientTaskType } from "@/generated/prisma/client";

/** ספירות מצב לכל לקוח, לתצוגה מהירה ברשימת הלקוחות. */
export type ClientTaskCounts = { actionable: number; overdue: number };

/**
 * סוף החודש הנוכחי - גבול "מה שכבר בעבודה".
 *
 * דיווח מוגש עד ה-15 בחודש שאחרי התקופה, אך העבודה עליו מתחילה כבר ב-1 לחודש.
 * לכן כל דיווח שמועדו חל בחודש הנוכחי נחשב לטיפול, ולא רק מיום ההגשה עצמו.
 */
function endOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * כמה משימות באמת ממתינות לטיפול אצל כל לקוח.
 *
 * **דיווחים של חודשים עתידיים אינם נספרים.** המערכת מייצרת דיווחים חודשים
 * מראש, וספירתם הופכת לקוח מסודר ל"16 משימות פתוחות" - מספר שאינו אומר דבר.
 */
export async function getTaskCountsByClient(): Promise<Map<string, ClientTaskCounts>> {
  const today = startOfToday();
  const monthEnd = endOfCurrentMonth();

  const [actionable, overdue] = await Promise.all([
    prisma.clientTask.groupBy({
      by: ["clientId"],
      where: { status: { in: OPEN_STATUSES }, dueDate: { lt: monthEnd } },
      _count: { _all: true },
    }),
    prisma.clientTask.groupBy({
      by: ["clientId"],
      where: { status: { in: OPEN_STATUSES }, dueDate: { lt: today } },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, ClientTaskCounts>();
  for (const row of actionable) {
    counts.set(row.clientId, { actionable: row._count._all, overdue: 0 });
  }
  for (const row of overdue) {
    const existing = counts.get(row.clientId) ?? { actionable: 0, overdue: 0 };
    counts.set(row.clientId, { ...existing, overdue: row._count._all });
  }

  return counts;
}

/**
 * מצב הדיווח מסוג מסוים אצל הלקוח:
 * - OVERDUE   מועד ההגשה חלף וטרם הוגש
 * - DUE       להגשה החודש - התקופה הסתיימה והעבודה עליה פתוחה
 * - SCHEDULED מסודר; התקופה הבאה קיימת אך מועדה בחודש עתידי
 * - CLEAR     אין תקופה פתוחה כלל
 */
export type ReportLineState = "OVERDUE" | "DUE" | "SCHEDULED" | "CLEAR";

export type ReportLine = {
  taskType: ClientTaskType;
  state: ReportLineState;
  /** המשימה הפתוחה הקרובה ביותר מסוג זה, אם יש */
  openTask: ClientTask | null;
  /** התקופה האחרונה שהוגשה מסוג זה, אם יש */
  lastSubmittedPeriod: string | null;
  lastSubmittedAt: Date | null;
  overdue: boolean;
};

export type ClientStatusSummary = {
  openCount: number;
  overdueCount: number;
  submittedCount: number;
  /** דיווחים חוזרים - שורת סיכום אחת לכל סוג, בלי לפרט כל חודש */
  recurringLines: ReportLine[];
  /** דוח שנתי ומשימות חד-פעמיות - אלה כן מוצגות כמשימות */
  otherLines: ReportLine[];
};

/** סוגי הדיווח שמנוהלים בלוח המעקב ולא כמשימות של הלקוח. */
const RECURRING_TYPES = RECURRING_TASK_TYPES;

/**
 * תמונת מצב של לקוח: לכל סוג דיווח - מה פתוח כרגע ומה כבר הוגש.
 *
 * עונה בבת אחת על "האם יש לו משימות פתוחות, האם הוגשו לו הדוחות,
 * ואם לא - איזה בדיוק פתוח".
 */
export function summarizeClientTasks(tasks: ClientTask[]): ClientStatusSummary {
  const today = startOfToday();
  const monthEnd = endOfCurrentMonth();
  const isOpen = (t: ClientTask) => OPEN_STATUSES.includes(t.status);

  const byType = new Map<ClientTaskType, ClientTask[]>();
  for (const task of tasks) {
    const list = byType.get(task.taskType) ?? [];
    list.push(task);
    byType.set(task.taskType, list);
  }

  const lines: ReportLine[] = [...byType.entries()].map(([taskType, list]) => {
    const open = list
      .filter(isOpen)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const submitted = list
      .filter((t) => !isOpen(t))
      .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

    const openTask = open[0] ?? null;
    const last = submitted[0] ?? null;
    const overdue = openTask ? openTask.dueDate < today : false;

    // דיווח שמועדו בחודש הנוכחי כבר בעבודה, גם אם ה-15 לחודש טרם הגיע.
    // רק דיווח של חודש עתידי נחשב "מתוזמן" ואינו מוצג כממתין לטיפול.
    const state: ReportLineState = !openTask
      ? "CLEAR"
      : overdue
        ? "OVERDUE"
        : openTask.dueDate < monthEnd
          ? "DUE"
          : "SCHEDULED";

    return {
      taskType,
      state,
      openTask,
      lastSubmittedPeriod: last?.periodLabel ?? null,
      lastSubmittedAt: last?.completedAt ?? null,
      overdue,
    };
  });

  // סדר לפי דחיפות: באיחור, להיום, מתוזמן, ולבסוף מה שאין בו תקופה פתוחה
  const rank: Record<ReportLineState, number> = {
    OVERDUE: 0,
    DUE: 1,
    SCHEDULED: 2,
    CLEAR: 3,
  };
  lines.sort((a, b) => {
    if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
    if (a.openTask && b.openTask) {
      return a.openTask.dueDate.getTime() - b.openTask.dueDate.getTime();
    }
    return 0;
  });

  return {
    // "פתוח" = מה שצריך לטפל בו החודש, כולל מה שכבר באיחור
    openCount: tasks.filter((t) => isOpen(t) && t.dueDate < monthEnd).length,
    overdueCount: tasks.filter((t) => isOpen(t) && t.dueDate < today).length,
    submittedCount: tasks.filter((t) => !isOpen(t)).length,
    recurringLines: lines.filter((l) => RECURRING_TYPES.includes(l.taskType)),
    otherLines: lines.filter((l) => !RECURRING_TYPES.includes(l.taskType)),
  };
}
