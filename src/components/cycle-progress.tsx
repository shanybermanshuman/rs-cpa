import { cn } from "@/lib/utils";

/** פס התקדמות של מחזור דיווח: כמה לקוחות כבר הוגשו מתוך הסך. */
export function CycleProgress({
  done,
  total,
  overdue = false,
}: {
  done: number;
  total: number;
  overdue?: boolean;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 w-32 shrink-0 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${done} מתוך ${total} הוגשו`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            overdue ? "bg-destructive" : "bg-accent",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}
