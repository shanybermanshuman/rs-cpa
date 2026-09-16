import { z } from "zod";
import { MAX_YEAR, MIN_YEAR } from "@/lib/dates";

/**
 * שדה טקסט לא חובה בטופס.
 *
 * **חובה `.optional()`**: שדה שאינו קיים כלל בטופס (או תיבת סימון שאינה
 * מסומנת) פשוט לא נשלח, ואז המפתח חסר לגמרי מה-FormData. Zod דוחה מפתח חסר
 * עוד לפני בדיקת הערך, וכתוצאה מכך השמירה נכשלת עם שגיאה כללית בלי שאף שדה
 * מסומן - באג שכבר קרה כאן פעמיים. `.optional()` הוא מה שמונע אותו.
 */
export const optionalText = z
  .string()
  .optional()
  .transform((v) => v?.trim() || null);

/** תיבת סימון: אינה נשלחת כשהיא לא מסומנת. */
export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

/**
 * תאריך לא חובה.
 *
 * הערך מגיע כ-ISO מ-`DateField`, אך הוא נבדק כאן גם כך: תאריך לא תקין או
 * שנה מחוץ לתחום נדחים במקום להיכתב למסד. שנת `0026` שנשמרה בפועל ללקוח
 * אמיתי היא הסיבה שהבדיקה הזו קיימת.
 */
export const optionalDate = z
  .string()
  .optional()
  .transform((v) => v?.trim() ?? "")
  .refine((v) => v === "" || !Number.isNaN(new Date(v).getTime()), "תאריך לא תקין")
  .refine((v) => {
    if (v === "") return true;
    const year = new Date(v).getUTCFullYear();
    return year >= MIN_YEAR && year <= MAX_YEAR;
  }, `השנה חייבת להיות בין ${MIN_YEAR} ל-${MAX_YEAR}`)
  .transform((v) => (v === "" ? null : new Date(v)));

/** מספר לא חובה. מחזיר null כשהשדה ריק או חסר. */
export const optionalNumber = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? Number(v) : null));
