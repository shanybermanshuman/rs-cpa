import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { DeleteTaskButton } from "@/components/delete-task-button";
import {
  clientTaskTypeLabel,
  clientTaskTypeLabels,
  recurrenceFrequencyLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/enums";
import { describeDueDate, formatDate } from "@/lib/dates";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { id } = await params;
  const task = await prisma.clientTask.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, businessName: true } },
      assignee: { select: { name: true } },
      recurrenceRule: true,
    },
  });

  if (!task) notFound();

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href={`/clients/${task.client.id}`}
            className="text-sm text-muted-foreground hover:text-accent"
          >
            → חזרה לכרטיס {task.client.businessName}
          </Link>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">
                {clientTaskTypeLabel(task)}
              </h1>
              <Badge variant="outline">{taskStatusLabels[task.status]}</Badge>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/tasks/${task.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                עריכה
              </Link>
              <DeleteTaskButton taskId={task.id} />
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">פרטי המשימה</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <DetailRow
                label="לקוח"
                value={
                  <Link
                    href={`/clients/${task.client.id}`}
                    className="text-accent hover:underline"
                  >
                    {task.client.businessName}
                  </Link>
                }
              />
              <DetailRow label="תקופת הדיווח" value={task.periodLabel} />
              <DetailRow
                label="מועד הגשה"
                value={`${formatDate(task.dueDate)} · ${describeDueDate(task.dueDate)}`}
              />
              <DetailRow label="אחראי/ת" value={task.assignee?.name} />
              <DetailRow label="עדיפות" value={taskPriorityLabels[task.priority]} />
              <DetailRow
                label="הושלמה בתאריך"
                value={task.completedAt ? formatDate(task.completedAt) : null}
              />
              <DetailRow label="הערות" value={task.notes} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">מקור המשימה</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {task.recurrenceRule ? (
              <>
                נוצרה אוטומטית מדיווח חוזר:{" "}
                <span className="font-medium text-foreground">
                  {clientTaskTypeLabels[task.recurrenceRule.taskType]} ·{" "}
                  {recurrenceFrequencyLabels[task.recurrenceRule.frequency]} · ב-
                  {task.recurrenceRule.dayOfMonth} לחודש
                </span>
                . משימה נוספת לתקופה הבאה תיווצר אוטומטית.
              </>
            ) : (
              "משימה חד-פעמית שנוצרה ידנית. היא לא תיווצר שוב אוטומטית."
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
