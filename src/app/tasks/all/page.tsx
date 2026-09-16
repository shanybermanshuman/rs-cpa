import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { TaskStatusSelect } from "@/components/task-status-select";
import { clientTaskTypeLabel, clientTaskTypeLabels, taskStatusLabels, toOptions } from "@/lib/enums";
import { daysUntil, describeDueDate, formatDate, startOfToday } from "@/lib/dates";
import { countLabel, TASK_FORMS } from "@/lib/hebrew";
import { OPEN_STATUSES } from "@/lib/task-generator";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma, TaskStatus } from "@/generated/prisma/client";

/**
 * רשימה שטוחה של משימות בודדות - תצוגה משנית, לחיפוש נקודתי.
 * המעקב היומיומי מתבצע במסך מחזורי הדיווח (`/tasks`).
 */
export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    assignee?: string;
    client?: string;
    view?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const {
    status = "",
    type = "",
    assignee = "",
    client = "",
    view = "open",
  } = await searchParams;

  const where: Prisma.ClientTaskWhereInput = {
    ...(status ? { status: status as TaskStatus } : {}),
    ...(type ? { taskType: type as Prisma.EnumClientTaskTypeFilter["equals"] } : {}),
    ...(assignee ? { assigneeId: assignee } : {}),
    ...(client ? { clientId: client } : {}),
    ...(view === "open" && !status ? { status: { in: OPEN_STATUSES } } : {}),
    ...(view === "overdue"
      ? { dueDate: { lt: startOfToday() }, status: { in: OPEN_STATUSES } }
      : {}),
  };

  const [tasks, users, clients] = await Promise.all([
    prisma.clientTask.findMany({
      where,
      include: {
        client: { select: { id: true, businessName: true } },
        assignee: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 300,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      select: { id: true, businessName: true },
      orderBy: { businessName: "asc" },
    }),
  ]);

  const selectedClient = clients.find((c) => c.id === client);
  const views = [
    { key: "open", label: "פתוחות" },
    { key: "overdue", label: "באיחור" },
    { key: "all", label: "הכל" },
  ];
  const keepClient = client ? `&client=${client}` : "";

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/tasks" className="text-sm text-muted-foreground hover:text-accent">
              → חזרה לדיווחים השוטפים
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">כל המשימות</h1>
            <p className="text-sm text-muted-foreground">
              {countLabel(tasks.length, TASK_FORMS)} מוצגות
              {selectedClient && ` · ${selectedClient.businessName}`}
            </p>
          </div>
          <Link
            href={client ? `/tasks/new?client=${client}` : "/tasks/new"}
            className={buttonVariants()}
          >
            משימה חדשה
          </Link>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex gap-2">
              {views.map((v) => (
                <Link
                  key={v.key}
                  href={`/tasks/all?view=${v.key}${keepClient}`}
                  className={buttonVariants({
                    variant: view === v.key ? "default" : "outline",
                    size: "sm",
                  })}
                >
                  {v.label}
                </Link>
              ))}
            </div>

            <form className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="view" value={view} />
              <div className="w-52 space-y-2">
                <label htmlFor="client" className="text-sm font-medium">
                  לקוח
                </label>
                <NativeSelect id="client" name="client" defaultValue={client}>
                  <option value="">כל הלקוחות</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="w-44 space-y-2">
                <label htmlFor="type" className="text-sm font-medium">
                  סוג משימה
                </label>
                <NativeSelect id="type" name="type" defaultValue={type}>
                  <option value="">הכל</option>
                  {toOptions(clientTaskTypeLabels).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="w-40 space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  סטטוס
                </label>
                <NativeSelect id="status" name="status" defaultValue={status}>
                  <option value="">הכל</option>
                  {toOptions(taskStatusLabels).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="submit" variant="outline">
                סינון
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {tasks.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                אין משימות התואמות לסינון.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">לקוח</TableHead>
                    <TableHead className="text-right">משימה</TableHead>
                    <TableHead className="text-right">מועד הגשה</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const days = daysUntil(task.dueDate);
                    const isOpen = OPEN_STATUSES.includes(task.status);
                    const isLate = days < 0 && isOpen;
                    const isSoon = days >= 0 && days <= 3 && isOpen;

                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Link
                            href={`/clients/${task.client.id}`}
                            className="font-medium hover:text-accent hover:underline"
                          >
                            {task.client.businessName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/tasks/${task.id}`}
                            className="font-medium hover:text-accent hover:underline"
                          >
                            {clientTaskTypeLabel(task)}
                          </Link>
                          {task.periodLabel && (
                            <div className="text-xs text-muted-foreground">
                              {task.periodLabel}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className={cn(isLate && "font-semibold text-destructive")}>
                            {formatDate(task.dueDate)}
                          </div>
                          {(isLate || isSoon) && (
                            <div
                              className={cn(
                                "text-xs",
                                isLate ? "text-destructive" : "text-accent",
                              )}
                            >
                              {describeDueDate(task.dueDate)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <TaskStatusSelect taskId={task.id} status={task.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
