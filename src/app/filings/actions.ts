"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { OPEN_STATUSES } from "@/lib/task-generator";

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

  const raw = String(formData.get("amount") ?? "").replace(/[,\s₪]/g, "").trim();
  if (raw !== "" && !/^-?\d+(\.\d+)?$/.test(raw)) return;

  const amount = raw === "" ? null : Number(raw);
  if (amount !== null && !Number.isFinite(amount)) return;

  await prisma.clientTask.update({
    where: { id: taskId },
    data: { amount },
  });

  revalidatePath("/filings");
}
