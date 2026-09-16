import Link from "next/link";
import { TaskStatusSelect } from "@/components/task-status-select";
import { clientTaskTypeLabel } from "@/lib/enums";
import { daysUntil, describeDueDate, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ClientTask } from "@/generated/prisma/client";

type Row = ClientTask & { client: { id: string; businessName: string } };

/**
 * שורת משימה בודדת. מציגה את כל מה שצריך כדי להבין ולטפל - לקוח, סוג, מועד,
 * הערה וסטטוס - **בלי להיכנס למסך המשימה**. שינוי סטטוס נעשה מכאן ישירות.
 */
export function IndividualTaskRow({ task }: { task: Row }) {
  const days = daysUntil(task.dueDate);
  const isLate = days < 0;
  const isSoon = days >= 0 && days <= 3;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
      <div className="min-w-52 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            href={`/clients/${task.client.id}`}
            className="font-medium hover:text-accent hover:underline"
          >
            {task.client.businessName}
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href={`/tasks/${task.id}`}
            className="text-sm hover:text-accent hover:underline"
          >
            {clientTaskTypeLabel(task)}
            {task.periodLabel && (
              <span className="text-muted-foreground"> ({task.periodLabel})</span>
            )}
          </Link>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
          <span
            className={cn(
              isLate ? "font-medium text-destructive" : "text-muted-foreground",
              isSoon && "text-accent",
            )}
          >
            {formatDate(task.dueDate)} · {describeDueDate(task.dueDate)}
          </span>
          {task.notes && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="truncate text-muted-foreground" title={task.notes}>
                {task.notes}
              </span>
            </>
          )}
        </div>
      </div>

      <TaskStatusSelect taskId={task.id} status={task.status} />
    </div>
  );
}
