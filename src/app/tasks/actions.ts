"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const statusSchema = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "WAITING_ON_CLIENT",
  "SUBMITTED",
  "DONE",
  "OVERDUE",
]);

/** עדכון סטטוס משימה מתוך הרשימה, ללא מעבר למסך נפרד. */
export async function updateTaskStatus(taskId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const parsed = statusSchema.safeParse(formData.get("status"));
  if (!parsed.success) return;

  const status = parsed.data;

  await prisma.clientTask.update({
    where: { id: taskId },
    data: {
      status,
      // שומרים מתי הושלמה בפועל, לצורך מדידת עמידה ביעדים בהמשך
      completedAt: status === "DONE" ? new Date() : null,
    },
  });

  revalidateTaskScreens();
}

/** סימון מהיר של משימה כהוגשה, מתוך מסך מחזור הדיווח. */
export async function markTaskSubmitted(taskId: string) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.clientTask.update({
    where: { id: taskId },
    data: { status: "SUBMITTED" },
  });

  revalidateTaskScreens();
}

function revalidateTaskScreens() {
  revalidatePath("/tasks");
  revalidatePath("/filings");
  revalidatePath("/tasks/all");
  revalidatePath("/annual-reports");
  revalidatePath("/");
}
