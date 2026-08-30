const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** תאריך בפורמט ישראלי, למשל 15/02/2026. */
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** תחילת היום הנוכחי ב-UTC, להשוואה מול תאריכי יעד. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * מספר הימים עד מועד ההגשה. שלילי = באיחור.
 * משמש לצביעת משימות דחופות בלוח הבקרה וברשימת המשימות.
 */
export function daysUntil(dueDate: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((dueDate.getTime() - startOfToday().getTime()) / MS_PER_DAY);
}

/** תיאור מילולי של מועד ההגשה, למשל "בעוד 3 ימים" או "באיחור של יומיים". */
export function describeDueDate(dueDate: Date): string {
  const days = daysUntil(dueDate);

  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  if (days === -1) return "באיחור של יום";
  if (days === -2) return "באיחור של יומיים";
  if (days < 0) return `באיחור של ${Math.abs(days)} ימים`;
  if (days === 2) return "בעוד יומיים";
  return `בעוד ${days} ימים`;
}
