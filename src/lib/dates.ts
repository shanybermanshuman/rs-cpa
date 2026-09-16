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

/** גבולות שנה סבירים. שומרים מפני שגיאת הקלדה כמו 26 שנשמר כשנת 0026. */
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

/**
 * מפרש תאריך שהוקלד בסדר הישראלי - יום/חודש/שנה.
 *
 * שדה `input[type=date]` מציג את הפורמט לפי שפת הדפדפן, ובמחשב באנגלית
 * הוא מציג חודש/יום - מה שגרם כאן לתאריך שגוי בפועל. לכן ההקלדה היא
 * טקסט חופשי שמפורש כאן במפורש, ולא נשארת לשיקול הדפדפן.
 *
 * מקבל `15/2/2026`, `15.2.26`, `15-02-2026` ו-`15022026`.
 * מחזיר `yyyy-mm-dd` או null אם התאריך אינו תקין.
 */
export function parseIsraeliDate(input: string): string | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  let day: number;
  let month: number;
  let year: number;

  const parts = cleaned.split(/[/.\-\s]+/).filter(Boolean);
  if (parts.length === 3 && parts.every((p) => /^\d{1,4}$/.test(p))) {
    [day, month, year] = parts.map(Number);
  } else if (/^\d{8}$/.test(cleaned)) {
    day = Number(cleaned.slice(0, 2));
    month = Number(cleaned.slice(2, 4));
    year = Number(cleaned.slice(4));
  } else {
    return null;
  }

  // שנה דו-ספרתית מתפרשת כמאה הנוכחית: 26 הוא 2026 ולא 0026
  if (year < 100) year += 2000;
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  // תופס 31/02 וכדומה, שה-Date מגלגל לחודש הבא
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  return date.toISOString().slice(0, 10);
}

/** תאריך ISO לתצוגה בסדר הישראלי, לשדה הקלדה. */
export function isoToIsraeliDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
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
