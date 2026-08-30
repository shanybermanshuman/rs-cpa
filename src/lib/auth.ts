import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";

/**
 * מחזיר את רשומת העובד/ת מהמערכת עבור המשתמש המחובר.
 *
 * ההתחברות עצמה מנוהלת ב-Supabase Auth, בעוד שההרשאות והשיוך למשימות מנוהלים
 * בטבלת `users` שלנו. הקישור בין השניים נעשה לפי כתובת המייל.
 *
 * מחזיר null אם אין משתמש מחובר, או אם המחובר אינו מוגדר כעובד/ת במערכת.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  return prisma.user.findUnique({ where: { email: user.email } });
}

/** האם המשתמש/ת שותפה, כלומר בעל/ת גישה מלאה לכל הלקוחות וההגדרות. */
export function isPartner(user: User | null): boolean {
  return user?.role === "PARTNER";
}
