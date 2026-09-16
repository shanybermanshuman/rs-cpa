"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  backfillFilingAmount,
  backfillMarkSubmitted,
  setFilingAmount,
  toggleFilingCell,
} from "@/app/filings/actions";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BoardCell } from "@/lib/filing-board";

const STATE_STYLES = {
  SUBMITTED: "bg-accent/20 text-accent hover:bg-accent/30",
  OPEN: "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
  OVERDUE: "bg-destructive/15 text-destructive hover:bg-destructive/25",
  MISSING: "",
  NONE: "",
} as const;

const STATE_SYMBOLS = {
  SUBMITTED: "✓",
  OPEN: "○",
  OVERDUE: "!",
  MISSING: "–",
  NONE: "·",
} as const;

const STATE_TITLES = {
  SUBMITTED: "הוגש — לחיצה מבטלת",
  OPEN: "טרם הוגש — לחיצה מסמנת כהוגש",
  OVERDUE: "באיחור — לחיצה מסמנת כהוגש",
  MISSING: "תקופה שקדמה לשימוש במערכת — לחיצה מסמנת שדווח",
  NONE: "לא רלוונטי",
} as const;

function CellButton({ cell, label }: { cell: BoardCell; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={`${label} · ${STATE_TITLES[cell.state]}`}
      aria-label={`${label} · ${STATE_TITLES[cell.state]}`}
      className={cn(
        "size-8 rounded text-sm font-medium transition-colors disabled:opacity-50",
        STATE_STYLES[cell.state],
      )}
    >
      {pending ? "…" : STATE_SYMBOLS[cell.state]}
    </button>
  );
}

/** תא של תקופה שחלפה ואין לה שורה. מקווקו כדי שלא ייראה כמו "טרם הוגש". */
function MissingButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const title = `${label} · ${STATE_TITLES.MISSING}`;

  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      aria-label={title}
      className="size-8 rounded border border-dashed text-sm text-muted-foreground/60 transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent disabled:opacity-50"
    >
      {pending ? "…" : STATE_SYMBOLS.MISSING}
    </button>
  );
}

/**
 * הזנת סכום הדיווח. נשמר ביציאה מהשדה (blur) ולא בכפתור נפרד, כי מזינים
 * עשרות סכומים ברצף ולחיצת שמירה לכל אחד תאט את העבודה.
 */
function AmountInput({ cell, label }: { cell: BoardCell; label: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const initial = cell.amount === null ? "" : String(cell.amount);

  const change =
    cell.changePct === null
      ? null
      : `${cell.changePct > 0 ? "+" : ""}${Math.round(cell.changePct)}%`;

  // תקופה שאין לה שורה נקלטת למפרע; לתקופה קיימת מעדכנים את הסכום
  const action = cell.backfill
    ? backfillFilingAmount.bind(null, cell.backfill)
    : setFilingAmount.bind(null, cell.taskId!);

  return (
    <form ref={formRef} action={action}>
      <input
        type="text"
        inputMode="decimal"
        name="amount"
        key={initial}
        defaultValue={initial}
        placeholder="סכום"
        aria-label={`סכום · ${label}`}
        title={
          cell.prevAverage !== null
            ? `ממוצע התקופות הקודמות: ${formatAmount(Math.round(cell.prevAverage))} ₪`
            : "סכום הדיווח"
        }
        onBlur={(e) => {
          if (e.currentTarget.value.trim() !== initial) formRef.current?.requestSubmit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "h-6 w-20 rounded border bg-transparent px-1 text-center text-xs tabular-nums",
          "focus:border-accent focus:outline-none",
          cell.unusual && "border-destructive/60 bg-destructive/5",
        )}
      />
      {change && (
        <div
          className={cn(
            "text-[10px] tabular-nums",
            cell.unusual
              ? "font-medium text-destructive"
              : "text-muted-foreground",
          )}
          title={
            cell.unusual
              ? "חריגה מהותית מהתקופות הקודמות — כדאי לבדוק"
              : "שינוי מול התקופה הקודמת"
          }
        >
          {cell.unusual && "⚠ "}
          {change}
        </div>
      )}
    </form>
  );
}

/** תא בלוח המעקב. לחיצה מסמנת הוגש / מבטלת. */
export function FilingBoardCell({
  cell,
  label,
  showAmount = false,
}: {
  cell: BoardCell;
  label: string;
  showAmount?: boolean;
}) {
  // תקופה שחלפה ואין לה שורה (לפני תחילת השימוש במערכת): לחיצה מסמנת אותה
  // כ"דווח", ובהצגת סכומים אפשר גם להקליד את הסכום. שני המצבים חייבים לעבוד -
  // לא לכל דיווח יש סכום בהישג יד, ובמקדמות ובניכויים לרוב רק מסמנים.
  if (cell.state === "MISSING" && cell.backfill) {
    return (
      <div className="inline-flex flex-col items-center gap-1">
        <form action={backfillMarkSubmitted.bind(null, cell.backfill)} className="inline">
          <MissingButton label={label} />
        </form>
        {showAmount && <AmountInput cell={cell} label={label} />}
      </div>
    );
  }

  if (!cell.taskId || cell.state === "NONE") {
    return (
      <span
        className="inline-flex size-8 items-center justify-center text-sm text-muted-foreground/40"
        title="אין דיווח לתקופה זו"
      >
        ·
      </span>
    );
  }

  // התקופה שהדיווח מכסה חשובה יותר מחודש ההגשה, במיוחד בדיווח דו-חודשי
  const fullLabel = cell.periodLabel ? `${label} · ${cell.periodLabel}` : label;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <form action={toggleFilingCell.bind(null, cell.taskId)} className="inline">
        <CellButton cell={cell} label={fullLabel} />
      </form>
      {showAmount && <AmountInput cell={cell} label={fullLabel} />}
    </div>
  );
}
