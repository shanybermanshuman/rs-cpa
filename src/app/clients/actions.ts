"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { syncDefaultRulesForClient } from "@/lib/task-generator";
import {
  checkbox,
  optionalDate,
  optionalNumber,
  optionalText,
} from "@/lib/form-schema";

const clientSchema = z.object({
  businessName: z.string().trim().min(1, "יש להזין שם עסק"),
  taxId: optionalText,
  clientType: z.enum(["COMPANY", "SELF_EMPLOYED", "CONTROLLING_SHAREHOLDER"]),
  serviceType: z.enum([
    "FULL",
    "BOOKKEEPING",
    "SELF_EMPLOYED_PACKAGE",
    "ACCOUNTING_ONLY",
    "OTHER",
  ]),
  serviceTypeOther: optionalText,
  vatFrequency: z
    .string()
    .optional()
    .transform((v) => (v === "MONTHLY" || v === "BIMONTHLY" ? v : null)),
  hasEmployees: checkbox,
  withholdingFileNumber: optionalText,
  withholdingRate: optionalNumber.refine(
    (v) => v === null || (!Number.isNaN(v) && v >= 0 && v <= 100),
    "שיעור הניכוי חייב להיות בין 0 ל-100",
  ),
  withholdingValidUntil: optionalDate,
  status: z.enum(["ACTIVE", "INACTIVE", "ONBOARDING"]),
  engagementDate: optionalDate,
  monthlyFee: optionalNumber.refine(
    (v) => v === null || (!Number.isNaN(v) && v >= 0),
    "שכר טרחה אינו תקין",
  ),
  ownerId: optionalText,
  documentsFolderUrl: optionalText,
  notes: optionalText,
});

export type ClientFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseForm(formData: FormData) {
  return clientSchema.safeParse(Object.fromEntries(formData));
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

export async function createClient(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const client = await prisma.client.create({ data: parsed.data });

  // הגדרת המשימות הסטטוטוריות החוזרות של הלקוח מיד עם הקליטה
  await syncDefaultRulesForClient(client.id);

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(
  clientId: string,
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: toFieldErrors(parsed.error) };
  }

  await prisma.client.update({ where: { id: clientId }, data: parsed.data });

  // לקוח פעיל צריך לקבל את משימותיו מיד ולא להמתין לריצה היומית. הסנכרון גם
  // משלים כללים שנוספו בעקבות העדכון (למשל השלמת תדירות מע"מ אחרי ייבוא).
  if (parsed.data.status === "ACTIVE") {
    await syncDefaultRulesForClient(clientId);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
