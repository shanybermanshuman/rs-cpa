"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { optionalText } from "@/lib/form-schema";
import { MAX_YEAR, MIN_YEAR } from "@/lib/dates";

const taskSchema = z.object({
  clientId: z.string().trim().min(1, "יש לבחור לקוח"),
  taskType: z.enum([
    "VAT",
    "INCOME_TAX_ADVANCE",
    "NATIONAL_INSURANCE",
    "WITHHOLDING_TAX",
    "WITHHOLDING_NI",
    "QUARTERLY_PL_REPORT",
    "ANNUAL_REPORT",
    "CAPITAL_DECLARATION",
    "OTHER",
  ]),
  taskTypeOther: optionalText,
  dueDate: z
    .string()
    .trim()
    .min(1, "יש להזין מועד הגשה")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "תאריך לא תקין")
    .refine((v) => {
      const year = new Date(v).getUTCFullYear();
      return year >= MIN_YEAR && year <= MAX_YEAR;
    }, `השנה חייבת להיות בין ${MIN_YEAR} ל-${MAX_YEAR}`)
    .transform((v) => new Date(v)),
  periodLabel: optionalText,
  status: z.enum([
    "NOT_STARTED",
    "IN_PROGRESS",
    "WAITING_ON_CLIENT",
    "SUBMITTED",
    "DONE",
    "OVERDUE",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  assigneeId: optionalText,
  notes: optionalText,
});

export type ClientTaskFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

function revalidateTaskViews(clientId: string) {
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath(`/clients/${clientId}`);
}

export async function createClientTask(
  _prevState: ClientTaskFormState,
  formData: FormData,
): Promise<ClientTaskFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: toFieldErrors(parsed.error) };
  }

  // משימה שנוצרת ידנית אינה משויכת לכלל חזרה, ולכן לא תיווצר שוב אוטומטית
  const task = await prisma.clientTask.create({
    data: { ...parsed.data, completedAt: parsed.data.status === "DONE" ? new Date() : null },
  });

  revalidateTaskViews(task.clientId);
  redirect(`/clients/${task.clientId}`);
}

export async function updateClientTask(
  taskId: string,
  _prevState: ClientTaskFormState,
  formData: FormData,
): Promise<ClientTaskFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const existing = await prisma.clientTask.findUnique({
    where: { id: taskId },
    select: { completedAt: true },
  });

  const task = await prisma.clientTask.update({
    where: { id: taskId },
    data: {
      ...parsed.data,
      completedAt:
        parsed.data.status === "DONE" ? (existing?.completedAt ?? new Date()) : null,
    },
  });

  revalidateTaskViews(task.clientId);
  redirect(`/tasks/${taskId}`);
}

export async function deleteClientTask(taskId: string) {
  const user = await getCurrentUser();
  if (!user) return;

  const task = await prisma.clientTask.delete({ where: { id: taskId } });
  revalidateTaskViews(task.clientId);
  redirect(`/clients/${task.clientId}`);
}
