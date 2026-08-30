"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { periodLabelForYear } from "@/lib/annual";

export type AnnualFormState = {
  error?: string;
  /** מסומן רק אחרי פעולה שהצליחה - ראו ההסבר ב-contact-actions.ts */
  ok?: boolean;
};

const yearSchema = z.coerce
  .number()
  .int()
  .min(2000, "שנה לא תקינה")
  .max(2100, "שנה לא תקינה");

async function requirePartner() {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };
  if (user.role !== "PARTNER") return { error: "פעולה זו פתוחה לשותפות בלבד." };
  return null;
}

function revalidateAnnual() {
  revalidatePath("/annual-reports");
  revalidatePath("/");
}

/**
 * פותח שנת מס: יוצר משימת דוח שנתי לכל הלקוחות הפעילים שאין להם כבר אחת.
 *
 * מועד ההגשה נקבע בשלב זה כברירת מחדל בלבד (30 באפריל של השנה העוקבת);
 * המועד האמיתי של כל לקוח נקבע לפי גל האורכות שאליו ישויך.
 */
export async function createAnnualReports(
  _prevState: AnnualFormState,
  formData: FormData,
): Promise<AnnualFormState> {
  const denied = await requirePartner();
  if (denied) return denied;

  const parsed = yearSchema.safeParse(formData.get("year"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "שנה לא תקינה" };
  }

  const taxYear = parsed.data;
  const periodLabel = periodLabelForYear(taxYear);
  const dueDate = new Date(Date.UTC(taxYear + 1, 3, 30));

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, ownerId: true },
  });

  const existing = await prisma.clientTask.findMany({
    where: { taskType: "ANNUAL_REPORT", periodLabel },
    select: { clientId: true },
  });
  const alreadyHave = new Set(existing.map((t) => t.clientId));
  const toCreate = clients.filter((c) => !alreadyHave.has(c.id));

  if (toCreate.length === 0) {
    return { error: `לכל הלקוחות הפעילים כבר קיים דוח שנתי ל${periodLabel}.` };
  }

  await prisma.clientTask.createMany({
    data: toCreate.map((c) => ({
      clientId: c.id,
      taskType: "ANNUAL_REPORT" as const,
      dueDate,
      periodLabel,
      assigneeId: c.ownerId,
    })),
  });

  revalidateAnnual();
  redirect(`/annual-reports?period=${encodeURIComponent(periodLabel)}`);
}

const extensionSchema = z.object({
  taxYear: yearSchema,
  kind: z.enum(["COMPANY_AUDITED", "INDIVIDUAL"]),
  name: z.string().trim().min(1, "יש להזין שם למועד"),
  dueDate: z.string().trim().min(1, "יש להזין תאריך").transform((v) => new Date(v)),
});

/** הוספת מועד אורכה לשנת מס. */
export async function createExtension(
  _prevState: AnnualFormState,
  formData: FormData,
): Promise<AnnualFormState> {
  const denied = await requirePartner();
  if (denied) return denied;

  const parsed = extensionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const existing = await prisma.annualExtension.findUnique({
    where: {
      taxYear_kind_name: {
        taxYear: parsed.data.taxYear,
        kind: parsed.data.kind,
        name: parsed.data.name,
      },
    },
  });
  if (existing) {
    return { error: `כבר קיים מועד בשם "${parsed.data.name}" למסלול זה בשנה זו.` };
  }

  await prisma.annualExtension.create({ data: parsed.data });
  revalidateAnnual();
  return { ok: true };
}

export async function deleteExtension(extensionId: string) {
  const denied = await requirePartner();
  if (denied) return;

  // הלקוחות המשויכים אינם נמחקים - השיוך שלהם רק מתנתק (onDelete: SetNull)
  await prisma.annualExtension.delete({ where: { id: extensionId } });
  revalidateAnnual();
}

/**
 * שיוך דוח שנתי של לקוח לגל אורכות.
 * מעדכן גם את מועד ההגשה של המשימה, כדי שחישובי הדחיפות והאיחורים
 * בכל המערכת ימשיכו להסתמך על שדה אחד בלבד.
 */
export async function assignExtension(taskId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const extensionId = String(formData.get("extensionId") ?? "").trim() || null;

  if (!extensionId) {
    await prisma.clientTask.update({
      where: { id: taskId },
      data: { annualExtensionId: null },
    });
    revalidateAnnual();
    return;
  }

  const extension = await prisma.annualExtension.findUnique({
    where: { id: extensionId },
  });
  if (!extension) return;

  await prisma.clientTask.update({
    where: { id: taskId },
    data: { annualExtensionId: extension.id, dueDate: extension.dueDate },
  });

  revalidateAnnual();
}

/** שיוך כל הלקוחות שטרם שויכו בשנת מס נתונה לגל אורכות אחד. */
export async function assignAllUnassigned(
  _prevState: AnnualFormState,
  formData: FormData,
): Promise<AnnualFormState> {
  const denied = await requirePartner();
  if (denied) return denied;

  const extensionId = String(formData.get("extensionId") ?? "").trim();
  const periodLabel = String(formData.get("periodLabel") ?? "").trim();
  if (!extensionId || !periodLabel) return { error: "יש לבחור מועד." };

  const extension = await prisma.annualExtension.findUnique({
    where: { id: extensionId },
  });
  if (!extension) return { error: "המועד לא נמצא." };

  // משייכים רק לקוחות מהמסלול המתאים: מועד של חברות לא יחול על יחידים
  const { count } = await prisma.clientTask.updateMany({
    where: {
      taskType: "ANNUAL_REPORT",
      periodLabel,
      annualExtensionId: null,
      client:
        extension.kind === "COMPANY_AUDITED"
          ? { clientType: "COMPANY" }
          : { clientType: { not: "COMPANY" } },
    },
    data: { annualExtensionId: extension.id, dueDate: extension.dueDate },
  });

  if (count === 0) return { error: "אין לקוחות שטרם שויכו במסלול זה." };

  revalidateAnnual();
  return { ok: true };
}
