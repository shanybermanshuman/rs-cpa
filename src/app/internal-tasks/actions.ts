"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { optionalDate, optionalText } from "@/lib/form-schema";

const internalTaskSchema = z.object({
  title: z.string().trim().min(1, "יש להזין כותרת למשימה"),
  category: z.enum(["ADMIN", "HR", "MARKETING", "IT"]),
  status: z.enum([
    "NOT_STARTED",
    "IN_PROGRESS",
    "WAITING_ON_CLIENT",
    "SUBMITTED",
    "DONE",
    "OVERDUE",
  ]),
  dueDate: optionalDate,
  assigneeId: optionalText,
  notes: optionalText,
});

export type InternalTaskFormState = {
  /** מסומן רק אחרי שמירה שהצליחה - ראו ההסבר ב-contact-actions.ts */
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

export async function createInternalTask(
  _prevState: InternalTaskFormState,
  formData: FormData,
): Promise<InternalTaskFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = internalTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: toFieldErrors(parsed.error) };
  }

  await prisma.internalTask.create({ data: parsed.data });

  revalidatePath("/internal-tasks");
  return { ok: true };
}

export async function updateInternalTask(
  taskId: string,
  _prevState: InternalTaskFormState,
  formData: FormData,
): Promise<InternalTaskFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = internalTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: toFieldErrors(parsed.error) };
  }

  await prisma.internalTask.update({ where: { id: taskId }, data: parsed.data });

  revalidatePath("/internal-tasks");
  redirect("/internal-tasks");
}

/** עדכון סטטוס מהיר מתוך הרשימה. */
export async function updateInternalTaskStatus(taskId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const status = internalTaskSchema.shape.status.safeParse(formData.get("status"));
  if (!status.success) return;

  await prisma.internalTask.update({
    where: { id: taskId },
    data: { status: status.data },
  });

  revalidatePath("/internal-tasks");
}

export async function deleteInternalTask(taskId: string) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.internalTask.delete({ where: { id: taskId } });
  revalidatePath("/internal-tasks");
}
