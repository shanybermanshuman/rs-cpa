"use client";

import { useState } from "react";
import { isoToIsraeliDate, parseIsraeliDate } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * שדה תאריך בסדר הישראלי - יום/חודש/שנה.
 *
 * מחליף את `input[type=date]`, שמציג את הפורמט לפי שפת הדפדפן ובמחשב
 * באנגלית הציג חודש/יום. זה לא היה רק מבלבל: כך נשמר בפועל תאריך שגוי.
 *
 * מה שנשלח לשרת הוא שדה מוסתר בפורמט ISO, כך שכל הסכימות והפעולות
 * הקיימות ממשיכות לעבוד בלי שינוי. תאריך שאינו ניתן לפירוש **חוסם את
 * שליחת הטופס** דרך ולידציית הדפדפן, ולא נשמר בשקט כערך ריק.
 */
export function DateField({
  id,
  name,
  defaultValue = "",
  required = false,
  className,
}: {
  id: string;
  name: string;
  /** ערך ISO, למשל 2026-08-15 */
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(() => isoToIsraeliDate(defaultValue));
  const iso = parseIsraeliDate(text);
  const invalid = text.trim() !== "" && iso === null;

  return (
    <>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        placeholder="יום/חודש/שנה"
        maxLength={10}
        required={required}
        value={text}
        onChange={(e) => {
          setText(e.currentTarget.value);
          // חוסם שליחה של תאריך לא תקין במקום לאבד אותו בשקט
          const next = parseIsraeliDate(e.currentTarget.value);
          e.currentTarget.setCustomValidity(
            e.currentTarget.value.trim() !== "" && next === null
              ? "תאריך לא תקין. הפורמט הוא יום/חודש/שנה, למשל 15/08/2026"
              : "",
          );
        }}
        className={cn("text-center", invalid && "border-destructive", className)}
        aria-invalid={invalid}
      />
      <input type="hidden" name={name} value={iso ?? ""} />
      {invalid && (
        <p className="text-xs text-destructive">
          תאריך לא תקין — יום/חודש/שנה, למשל 15/08/2026
        </p>
      )}
    </>
  );
}
