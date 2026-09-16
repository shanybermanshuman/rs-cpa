import { prisma } from "@/lib/prisma";
import { OPEN_STATUSES } from "@/lib/task-generator";
import { daysUntil, describeDueDate, formatDate, startOfToday } from "@/lib/dates";
import { clientTaskTypeLabel } from "@/lib/enums";
import { WITHHOLDING_WARNING_DAYS, withholdingInfo } from "@/lib/withholding";

/**
 * מנוע ההתראות של המערכת.
 *
 * ההתראות **נגזרות מהנתונים ואינן נשמרות**: אין "סימון כנקרא" ואי אפשר לסגור
 * התראה. היא נעלמת כשהבעיה נפתרת - כשהמשימה מוגשת או כשהאישור מחודש. במערכת
 * ציות, התראה שאפשר לסגור היא התראה שתיסגר ותישכח.
 */

/** כמה ימים לפני מועד ההגשה מתחילים להתריע. */
export const TASK_LEAD_DAYS = 5;

export type AlertSeverity = "CRITICAL" | "WARNING";

export type AlertKind =
  | "TASK_OVERDUE"
  | "TASK_DUE_SOON"
  | "FILINGS_OVERDUE"
  | "WITHHOLDING_EXPIRED"
  | "WITHHOLDING_EXPIRING"
  | "INTERNAL_OVERDUE"
  | "INTERNAL_DUE_SOON";

export type Alert = {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
  /** התאריך שהוביל להתראה, למיון */
  date: Date | null;
};

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * כל ההתראות הפתוחות במשרד, ממוינות לפי דחיפות ואז לפי תאריך.
 *
 * דיווחים שוטפים באיחור מקובצים להתראה אחת ולא להתראה ללקוח: ארבעים דיווחים
 * באיחור הם שורה אחת שמובילה ללוח המעקב, אחרת הפעמון עצמו הופך לרעש.
 */
export async function getAlerts(): Promise<Alert[]> {
  const today = startOfToday();
  const soon = addDays(today, TASK_LEAD_DAYS + 1);
  const withholdingCutoff = addDays(today, WITHHOLDING_WARNING_DAYS + 1);

  const [clientTasks, internalTasks, clients] = await Promise.all([
    prisma.clientTask.findMany({
      where: {
        status: { in: OPEN_STATUSES },
        dueDate: { lt: soon },
        // גם לקוח בקליטה יכול להיות עם מועד הגשה אמיתי, ולכן רק לקוח
        // שאינו פעיל מוחרג
        client: { status: { not: "INACTIVE" } },
      },
      select: {
        id: true,
        taskType: true,
        taskTypeOther: true,
        dueDate: true,
        periodLabel: true,
        recurrenceRuleId: true,
        client: { select: { id: true, businessName: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.internalTask.findMany({
      where: { status: { in: OPEN_STATUSES }, dueDate: { lt: soon } },
      select: { id: true, title: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.client.findMany({
      where: {
        status: { not: "INACTIVE" },
        withholdingValidUntil: { not: null, lt: withholdingCutoff },
      },
      select: {
        id: true,
        businessName: true,
        withholdingRate: true,
        withholdingValidUntil: true,
      },
      orderBy: { withholdingValidUntil: "asc" },
    }),
  ]);

  const alerts: Alert[] = [];

  // דיווחים שוטפים - התראה מקובצת אחת, ורק על מה שכבר עבר את מועד ההגשה.
  // התראה מקדימה על כל דיווח חוזר הייתה מייצרת עשרות התראות בכל חודש.
  const overdueFilings = clientTasks.filter(
    (t) => t.recurrenceRuleId !== null && t.dueDate < today,
  );
  if (overdueFilings.length > 0) {
    const earliest = overdueFilings[0];
    alerts.push({
      id: "filings-overdue",
      kind: "FILINGS_OVERDUE",
      severity: "CRITICAL",
      title: `${overdueFilings.length} דיווחים שוטפים באיחור`,
      detail: `המוקדם: ${earliest.client.businessName} · ${
        earliest.periodLabel ?? formatDate(earliest.dueDate)
      }`,
      href: "/filings",
      date: earliest.dueDate,
    });
  }

  // משימות חד-פעמיות ודוחות שנתיים - כל אחת בנפרד, כי לכל אחת טיפול משלה
  for (const task of clientTasks) {
    if (task.recurrenceRuleId !== null) continue;

    const overdue = task.dueDate < today;
    const label = clientTaskTypeLabel(task);
    alerts.push({
      id: `task-${task.id}`,
      kind: overdue ? "TASK_OVERDUE" : "TASK_DUE_SOON",
      severity: overdue ? "CRITICAL" : "WARNING",
      title: `${task.client.businessName} · ${label}`,
      detail: `${task.periodLabel ? `${task.periodLabel} · ` : ""}${formatDate(
        task.dueDate,
      )} · ${describeDueDate(task.dueDate)}`,
      href: `/tasks/${task.id}`,
      date: task.dueDate,
    });
  }

  for (const task of internalTasks) {
    if (!task.dueDate) continue;
    const overdue = task.dueDate < today;
    alerts.push({
      id: `internal-${task.id}`,
      kind: overdue ? "INTERNAL_OVERDUE" : "INTERNAL_DUE_SOON",
      severity: overdue ? "CRITICAL" : "WARNING",
      title: task.title,
      detail: `משימה פנימית · ${formatDate(task.dueDate)} · ${describeDueDate(task.dueDate)}`,
      href: "/internal-tasks",
      date: task.dueDate,
    });
  }

  // ניכוי במקור: אישור שפג עולה ללקוח כסף מיידית, ולכן הוא תמיד קריטי
  for (const client of clients) {
    const wh = withholdingInfo(client);
    if (wh.state !== "EXPIRED" && wh.state !== "EXPIRING") continue;

    const expired = wh.state === "EXPIRED";
    const daysLeft = daysUntil(client.withholdingValidUntil!);
    alerts.push({
      id: `withholding-${client.id}`,
      kind: expired ? "WITHHOLDING_EXPIRED" : "WITHHOLDING_EXPIRING",
      // אישור שפג היום הוא היום האחרון שאפשר לפעול בו, ולכן הוא דחוף
      // ולא "לתשומת לב"
      severity: daysLeft <= 0 ? "CRITICAL" : "WARNING",
      title: `${client.businessName} · אישור ניכוי במקור`,
      detail: expired
        ? `פג ב-${formatDate(client.withholdingValidUntil!)}`
        : daysLeft === 0
          ? `פג היום · ${formatDate(client.withholdingValidUntil!)}`
          : `פג ב-${formatDate(client.withholdingValidUntil!)} · בעוד ${daysLeft} ימים`,
      href: `/clients/${client.id}`,
      date: client.withholdingValidUntil,
    });
  }

  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "CRITICAL" ? -1 : 1;
    return (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
  });
}

/** סיכום קצר לשורת הפתיחה של המייל היומי ולכותרת הפעמון. */
export function summarizeAlerts(alerts: Alert[]) {
  const critical = alerts.filter((a) => a.severity === "CRITICAL").length;
  return { total: alerts.length, critical, warning: alerts.length - critical };
}
