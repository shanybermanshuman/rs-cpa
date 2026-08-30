const money = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });

/**
 * סכום בש"ח עם מפריד אלפים, בלי אגורות.
 *
 * ממוקם ב-src/lib ולא ברכיב, כי רכיב מסומן `"use client"` מייצא לשרת רק
 * הפניות ולא פונקציות - קריאה לפונקציית עזר משם בקוד שרת נכשלת בזמן ריצה,
 * ו-TypeScript אינו תופס זאת.
 */
export function formatAmount(value: number) {
  return money.format(value);
}
