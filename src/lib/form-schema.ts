import { z } from "zod";

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

/** תאריך לא חובה משדה `type="date"`. */
export const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? new Date(v) : null));

/** מספר לא חובה. מחזיר null כשהשדה ריק או חסר. */
export const optionalNumber = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? Number(v) : null));
