import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { InternalTaskForm } from "@/components/internal-task-form";
import {
  DeleteInternalTaskButton,
  InternalTaskStatusSelect,
} from "@/components/internal-task-row-actions";
import { createInternalTask } from "./actions";
import { internalTaskCategoryLabels, toOptions } from "@/lib/enums";
import { OPEN_STATUSES } from "@/lib/task-generator";
import { daysUntil, formatDate } from "@/lib/dates";
import { countLabel, TASK_FORMS } from "@/lib/hebrew";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InternalTaskCategory, Prisma } from "@/generated/prisma/client";

export default async function InternalTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; assignee?: string; view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { category = "", assignee = "", view = "open" } = await searchParams;

  const where: Prisma.InternalTaskWhereInput = {
    ...(category ? { category: category as InternalTaskCategory } : {}),
    ...(assignee ? { assigneeId: assignee } : {}),
    ...(view === "open" ? { status: { in: OPEN_STATUSES } } : {}),
    ...(view === "done" ? { status: { in: ["DONE", "SUBMITTED"] } } : {}),
  };

  const [tasks, users] = await Promise.all([
    prisma.internalTask.findMany({
      where,
      include: { assignee: { select: { name: true } } },
      // משימות ללא תאריך יעד בסוף הרשימה
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const views = [
    { key: "open", label: "פתוחות" },
    { key: "done", label: "הושלמו" },
    { key: "all", label: "הכל" },
  ];

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">משימות פנימיות</h1>
          <p className="text-sm text-muted-foreground">
            משימות המשרד שאינן קשורות ללקוח מסוים · {countLabel(tasks.length, TASK_FORMS)}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">הוספת משימה</CardTitle>
          </CardHeader>
          <CardContent>
            <InternalTaskForm
              action={createInternalTask}
              users={users}
              submitLabel="הוספה"
              resetOnSuccess
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex gap-2">
              {views.map((v) => (
                <Link
                  key={v.key}
                  href={`/internal-tasks?view=${v.key}`}
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
              <div className="w-44 space-y-2">
                <label htmlFor="category" className="text-sm font-medium">
                  קטגוריה
                </label>
                <NativeSelect id="category" name="category" defaultValue={category}>
                  <option value="">הכל</option>
                  {toOptions(internalTaskCategoryLabels).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="w-44 space-y-2">
                <label htmlFor="assignee" className="text-sm font-medium">
                  אחראי/ת
                </label>
                <NativeSelect id="assignee" name="assignee" defaultValue={assignee}>
                  <option value="">הכל</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
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
                אין משימות פנימיות להצגה.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">משימה</TableHead>
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">תאריך יעד</TableHead>
                    <TableHead className="text-right">אחראי/ת</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const isLate =
                      task.dueDate !== null &&
                      daysUntil(task.dueDate) < 0 &&
                      OPEN_STATUSES.includes(task.status);

                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Link
                            href={`/internal-tasks/${task.id}/edit`}
                            className="font-medium hover:text-accent hover:underline"
                          >
                            {task.title}
                          </Link>
                          {task.notes && (
                            <div className="text-xs text-muted-foreground">{task.notes}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {internalTaskCategoryLabels[task.category]}
                        </TableCell>
                        <TableCell
                          className={cn(isLate && "font-semibold text-destructive")}
                        >
                          {task.dueDate ? formatDate(task.dueDate) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {task.assignee?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <InternalTaskStatusSelect taskId={task.id} status={task.status} />
                        </TableCell>
                        <TableCell>
                          <DeleteInternalTaskButton taskId={task.id} title={task.title} />
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
