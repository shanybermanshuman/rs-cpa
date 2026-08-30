import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { IndividualTaskRow } from "@/components/individual-task-row";
import { getIndividualTasks } from "@/lib/filing-cycles";
import { daysUntil } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * משימות לקוחות חד-פעמיות בלבד.
 *
 * הדיווחים החוזרים אינם כאן במכוון: הם חובה שחוזרת כל חודש ולא "משימה",
 * ולכן הם מנוהלים בלוח המעקב (`/filings`). הדוח השנתי מנוהל ב-`/annual-reports`.
 */
export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const tasks = await getIndividualTasks(100);
  const late = tasks.filter((t) => daysUntil(t.dueDate) < 0);

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">משימות לקוחות</h1>
            <p className="text-sm text-muted-foreground">
              משימות חד-פעמיות · הדיווחים השוטפים נמצאים ב
              <Link href="/filings" className="text-accent hover:underline">
                מעקב דיווחים
              </Link>
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/tasks/all" className={buttonVariants({ variant: "outline" })}>
              חיפוש בכל המשימות
            </Link>
            <Link href="/tasks/new" className={buttonVariants()}>
              משימה חדשה
            </Link>
          </div>
        </div>

        <Card className={cn(late.length > 0 && "border-destructive/40")}>
          <CardHeader>
            <CardTitle className="text-base">
              משימות פתוחות ({tasks.length})
              {late.length > 0 && (
                <span className="text-destructive"> · {late.length} באיחור</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {tasks.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                אין משימות חד-פעמיות פתוחות.
              </p>
            ) : (
              tasks.map((task) => <IndividualTaskRow key={task.id} task={task} />)
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
