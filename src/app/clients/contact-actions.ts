"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkbox, optionalText } from "@/lib/form-schema";

const contactSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם"),
  role: optionalText,
  phone: optionalText,
  email: optionalText,
  whatsapp: optionalText,
  notes: optionalText,
  isPrimary: checkbox,
});

export type ContactFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * מסומן רק אחרי שמירה שהצליחה בפועל.
   * המצב ההתחלתי הוא אובייקט ריק, ולכן "אין שגיאות" אינו מעיד על הצלחה -
   * בלי הדגל הזה טופס עריכה נסגר מיד עם פתיחתו.
   */
  ok?: boolean;
};

/**
 * מסמן איש קשר אחד כראשי ומבטל את הסימון מהשאר.
 * הראשי הוא זה שמוצג בכל מקום שבו מוצג "איש קשר" בודד.
 */
async function makePrimary(clientId: string, contactId: string) {
  await prisma.$transaction([
    prisma.clientContact.updateMany({
      where: { clientId, id: { not: contactId } },
      data: { isPrimary: false },
    }),
    prisma.clientContact.update({
      where: { id: contactId },
      data: { isPrimary: true },
    }),
  ]);
}

export async function createContact(
  clientId: string,
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: "יש לתקן את השדות המסומנים.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }

  const { isPrimary, ...data } = parsed.data;
  const existingCount = await prisma.clientContact.count({ where: { clientId } });

  const contact = await prisma.clientContact.create({
    data: { ...data, clientId, isPrimary: false },
  });

  // הראשון שנוצר הופך אוטומטית לראשי, כדי שלא יישאר לקוח בלי איש קשר ראשי
  if (isPrimary || existingCount === 0) {
    await makePrimary(clientId, contact.id);
  }

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function updateContact(
  contactId: string,
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: "יש לתקן את השדות המסומנים.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }

  const { isPrimary, ...data } = parsed.data;
  const contact = await prisma.clientContact.update({
    where: { id: contactId },
    data,
  });

  if (isPrimary) await makePrimary(contact.clientId, contact.id);

  revalidatePath(`/clients/${contact.clientId}`);
  return { ok: true };
}

export async function setPrimaryContact(contactId: string) {
  const user = await getCurrentUser();
  if (!user) return;

  const contact = await prisma.clientContact.findUnique({ where: { id: contactId } });
  if (!contact) return;

  await makePrimary(contact.clientId, contact.id);
  revalidatePath(`/clients/${contact.clientId}`);
}

export async function deleteContact(contactId: string) {
  const user = await getCurrentUser();
  if (!user) return;

  const contact = await prisma.clientContact.delete({ where: { id: contactId } });

  // אם נמחק הראשי, מקדמים את הראשון שנותר כדי שתמיד יהיה איש קשר ראשי
  if (contact.isPrimary) {
    const next = await prisma.clientContact.findFirst({
      where: { clientId: contact.clientId },
      orderBy: { createdAt: "asc" },
    });
    if (next) await makePrimary(contact.clientId, next.id);
  }

  revalidatePath(`/clients/${contact.clientId}`);
}
