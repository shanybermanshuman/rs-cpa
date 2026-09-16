"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { OPEN_STATUSES } from "@/lib/task-generator";
import { dueDateForPeriod } from "@/lib/recurrence";
import { startOfToday } from "@/lib/dates";
import type { ClientTaskType } from "@/generated/prisma/client";

/**
 * מפרש סכום שהוקלד. מחזיר null לשדה ריק (כלומר "נקה את הערך"), ו-undefined
 * לקלט שאינו מספר - שאז אין לשמור דבר.
 *
 * אינו מיוצא: בקובץ `"use server"` כל ייצוא חייב להיות פונקציה אסינכרונית.
 */
function parseAmount(value: FormDataEntryValue | null): number | null | undefined {
  const raw = String(value ?? "")
    .replace(/[,\s₪]/g, "")
    .trim();
  if (raw === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * לחיצה על תא בלוח: אם הדיווח טרם הוגש - מסמנת כהוגש, ואם כבר הוגש -
 * מבטלת את הסימון. זו הפעולה שנעשית עשרות פעמים בחודש, ולכן היא לחיצה אחת.
 */
export async function toggleFilingCell(taskId: string) {
  const user = await getCurrentUser();
  if (!user) return;

  const task = await prisma.clientTask.findUnique({
    where: { id: taskId },
    select: { status: true },
  });
  if (!task) return;

  const isOpen = OPEN_STATUSES.includes(task.status);

  await prisma.clientTask.update({
    where: { id: taskId },
    data: isOpen
      ? { status: "SUBMITTED", completedAt: new Date() }
      : { status: "NOT_STARTED", completedAt: null },
  });

  revalidatePath("/filings");
  revalidatePath("/");
}

/**
 * שמירת סכום הדיווח. הסכום נשמר כדי לאפשר השוואה בין תקופות ובדיקת סבירות,
 * ולכן שדה ריק מנקה את הערך במקום לשמור אפס - "לא הוזן" ו"אפס" אינם זהים.
 */
export async function setFilingAmount(taskId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const amount = parseAmount(formData.get("amount"));
  if (amount === undefined) return;

  await prisma.clientTask.update({
    where: { id: taskId },
    data: { amount },
  });

  revalidatePath("/filings");
}

type BackfillTarget = {
  clientId: string;
  taskType: ClientTaskType;
  periodYear: number;
  periodMonth: number;
};

/**
 * יוצר (או מעדכן) דיווח לתקופה שחלפה ואין לה שורה במערכת, כ"הוגש".
 *
 * התקופות שקדמו לתחילת השימוש במערכת לא נוצרו על ידי מנוע המשימות, ולכן
 * לא היה אפשר לסמן אותן או להקליד להן סכום.
 *
 * מועד ההגשה ותווית התקופה נגזרים מכלל הדיווח של הלקוח דרך אותה פונקציה
 * שהמנוע משתמש בה, ולכן השורה שנוצרת זהה לשורה שהמנוע היה יוצר - והאינדקס
 * הייחודי `[recurrenceRuleId, dueDate]` מונע כפילות אם הפעולה תרוץ שוב.
 *
 * `amount` שאינו מוגדר משאיר את הסכום הקיים ללא שינוי - כך סימון "דווח"
 * לא מוחק סכום שכבר הוזן.
 *
 * **אסור לייצא אותה**: כל ייצוא מקובץ `"use server"` הופך לנקודת קצה שאפשר
 * לקרוא לה מהדפדפן, והיא אינה בודקת הרשאה - את זה עושות הפעולות שעוטפות אותה.
 */
async function upsertBackfill(target: BackfillTarget, amount?: number) {
  const rule = await prisma.recurrenceRule.findFirst({
    where: {
      clientId: target.clientId,
      taskType: target.taskType,
      isActive: true,
    },
    select: {
      id: true,
      frequency: true,
      dayOfMonth: true,
      client: { select: { ownerId: true } },
    },
  });
  if (!rule) return;

  const period = dueDateForPeriod(
    rule.frequency,
    rule.dayOfMonth,
    target.periodYear,
    target.periodMonth,
  );
  if (!period) return;

  // רק תקופות שחלפו נקלטות למפרע
  if (period.dueDate >= startOfToday()) return;

  await prisma.clientTask.upsert({
    where: {
      recurrenceRuleId_dueDate: {
        recurrenceRuleId: rule.id,
        dueDate: period.dueDate,
      },
    },
    create: {
      clientId: target.clientId,
      recurrenceRuleId: rule.id,
      taskType: target.taskType,
      dueDate: period.dueDate,
      periodLabel: period.periodLabel,
      amount: amount ?? null,
      // כמו בשורות שהמנוע יוצר, כדי שדיווח שנקלט למפרע לא יהיה "יתום"
      assigneeId: rule.client.ownerId,
      status: "SUBMITTED",
      completedAt: new Date(),
    },
    update: amount === undefined ? {} : { amount },
  });

  revalidatePath("/filings");
  revalidatePath("/");
}

/** קליטת סכום למפרע לתקופה שחלפה. הדיווח נשמר כ"הוגש". */
export async function backfillFilingAmount(target: BackfillTarget, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const amount = parseAmount(formData.get("amount"));
  // שדה ריק אינו יוצר שורה: אין טעם לייצר דיווח בלי סכום
  if (amount === undefined || amount === null) return;

  await upsertBackfill(target, amount);
}

/**
 * סימון תקופה שחלפה כ"דווח", בלי סכום.
 *
 * לא לכל דיווח יש סכום בהישג יד - במקדמות ובניכויים לרוב רק רוצים לתעד
 * שהדיווח בוצע. בלי זה, התקופות שלפני השימוש במערכת נשארו חסרות סימון.
 */
export async function backfillMarkSubmitted(target: BackfillTarget) {
  const user = await getCurrentUser();
  if (!user) return;

  await upsertBackfill(target);
}
