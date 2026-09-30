"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { SNOOZE_DAYS } from "@/lib/alerts";

/**
 * דחיית התראה לשבוע.
 *
 * **דחייה ולא סגירה**: ההתראה חוזרת מעצמה כשהמועד חולף. במערכת ציות, התראה
 * שאפשר לסגור לתמיד היא התראה שתיסגר ותישכח - ודיווח שלא הוגש ייעלם מהמסך.
 * מצד שני, פעמון שאדום כל הזמן הופך לרקע ומפסיקים להסתכל עליו. הדחייה היא
 * הפשרה: מוציאה מהעין מה שכבר ידוע, ומחזירה אותו אם לא טופל.
 *
 * ההתראה נעלמת בעקבות זאת גם מהסיכום היומי במייל, כי שניהם נשענים על
 * `getAlerts`.
 */
export async function snoozeAlert(snoozeKey: string) {
  const user = await getCurrentUser();
  if (!user) return;

  const until = new Date(Date.now() + SNOOZE_DAYS * 86_400_000);
  // המזהה שמתחת למפתח, לניקוי דחייה של אותה התראה בשלב קודם
  const underlyingId = snoozeKey.slice(snoozeKey.indexOf(":") + 1);

  await prisma.$transaction([
    // ניקוי דחיות שפג תוקפן, כדי שהטבלה לא תתפח לאורך שנים
    prisma.alertSnooze.deleteMany({ where: { until: { lt: new Date() } } }),
    // דחייה של אותה התראה בשלב קודם כבר אינה מסתירה דבר אחרי ההסלמה, אך
    // הייתה ממשיכה להיספר במונה "התראות דחויות" ולהטעות
    prisma.alertSnooze.deleteMany({
      where: { alertId: { endsWith: `:${underlyingId}` } },
    }),
    prisma.alertSnooze.upsert({
      where: { alertId: snoozeKey },
      create: { alertId: snoozeKey, until, createdById: user.id },
      update: { until, createdById: user.id },
    }),
  ]);

  revalidatePath("/", "layout");
}

/**
 * ביטול כל הדחיות הפעילות.
 *
 * דחייה שאי אפשר לראות ולא לבטל היא חור שקוף במערכת ציות. הכפתור מחזיר
 * הכול למסך, כדי שמי שדחה בטעות לא יצטרך לחכות שבוע.
 */
export async function clearSnoozes() {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.alertSnooze.deleteMany({});
  revalidatePath("/", "layout");
}
