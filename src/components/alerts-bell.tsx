"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { clearSnoozes, snoozeAlert } from "@/app/alerts/actions";
import type { Alert } from "@/lib/alerts";
import { cn } from "@/lib/utils";

/**
 * פעמון ההתראות.
 *
 * התראה אינה נסגרת אלא נעלמת כשהבעיה נפתרת. אפשר **לדחות** אותה לשבוע,
 * והיא חוזרת מעצמה (ראו ההסבר ב-src/lib/alerts.ts). מה שכן נזכר הוא ההודעה הקופצת: היא מוצגת פעם אחת
 * לכניסה למערכת ולא בכל מעבר בין מסכים, אחרת היא הופכת למטרד ומפסיקים
 * להסתכל עליה.
 */
/**
 * דחיית התראה לשבוע.
 *
 * הכפתור יושב **מחוץ** לקישור ולא בתוכו: קישור עוטף כפתור הוא HTML לא חוקי,
 * והלחיצה הייתה גם מנווטת וגם דוחה.
 */
function SnoozeButton({ title }: { title: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={`דחיית "${title}" לשבוע`}
      aria-label={`דחיית ההתראה "${title}" לשבוע`}
      className="mt-2 me-2 shrink-0 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
    >
      {pending ? "…" : "דחה"}
    </button>
  );
}

function SnoozeForm({ alertId, title }: { alertId: string; title: string }) {
  return (
    <form action={snoozeAlert.bind(null, alertId)}>
      <SnoozeButton title={title} />
    </form>
  );
}

export function AlertsBell({
  alerts,
  snoozedCount,
}: {
  alerts: Alert[];
  snoozedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const critical = alerts.filter((a) => a.severity === "CRITICAL");

  // הודעה קופצת פעם אחת לכניסה, ורק על מה שקריטי
  useEffect(() => {
    if (critical.length === 0) return;
    const key = "rs-alerts-toast";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    toast.error(`${critical.length} דברים דורשים טיפול`, {
      description: critical
        .slice(0, 3)
        .map((a) => a.title)
        .join(" · "),
      duration: 8000,
    });
  }, [critical]);

  // סגירה בלחיצה מחוץ לחלונית או ב-Escape
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          alerts.length > 0
            ? `${alerts.length} התראות`
            : snoozedCount > 0
              ? `אין התראות פתוחות, ${snoozedCount} דחויות`
              : "אין התראות"
        }
        aria-expanded={open}
        className="relative flex size-9 items-center justify-center rounded-md transition-colors hover:bg-muted"
      >
        <Bell className="size-5" aria-hidden />
        {alerts.length > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -left-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold text-white tabular-nums",
              critical.length > 0 ? "bg-destructive" : "bg-accent",
            )}
          >
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-11 left-0 z-50 w-80 overflow-hidden rounded-md border bg-card shadow-lg md:w-96">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <span className="text-sm font-medium">התראות</span>
            {critical.length > 0 && (
              <span className="text-xs font-medium text-destructive">
                {critical.length} דחופות
              </span>
            )}
          </div>

          {snoozedCount > 0 && (
            <form
              action={clearSnoozes}
              className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2"
            >
              <span className="text-xs text-muted-foreground">
                {snoozedCount} התראות דחויות
              </span>
              <button
                type="submit"
                className="rounded px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-background"
              >
                החזרה למסך
              </button>
            </form>
          )}

          {alerts.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {snoozedCount > 0
                ? "אין התראות פתוחות כרגע, אך יש דחויות שיחזרו."
                : "אין התראות פתוחות. הכל מסודר."}
            </p>
          ) : (
            <>
            <ul className="max-h-96 divide-y overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id} className="flex items-start gap-1 hover:bg-muted">
                  <Link
                    href={alert.href}
                    onClick={() => setOpen(false)}
                    className="block min-w-0 flex-1 px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          alert.severity === "CRITICAL"
                            ? "bg-destructive"
                            : "bg-accent",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {alert.title}
                        </div>
                        <div
                          className={cn(
                            "truncate text-xs",
                            alert.severity === "CRITICAL"
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {alert.detail}
                        </div>
                      </div>
                    </div>
                  </Link>
                  {alert.snoozeKey && (
                    <SnoozeForm alertId={alert.snoozeKey} title={alert.title} />
                  )}
                </li>
              ))}
            </ul>
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              &quot;דחה&quot; מסתיר התראה לשבוע והיא חוזרת אם לא טופלה.
              דיווחים שוטפים אינם ניתנים לדחייה.
            </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
