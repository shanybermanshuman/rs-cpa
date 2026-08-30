import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { CycleProgress } from "@/components/cycle-progress";
import { TaskStatusSelect } from "@/components/task-status-select";
import { CreateAnnualReportsForm } from "@/components/create-annual-reports-form";
import {
  AddExtensionForm,
  AssignAllForm,
  DeleteExtensionButton,
  ExtensionSelect,
} from "@/components/annual-extension-controls";
import {
  ANNUAL_KINDS,
  annualReportKind,
  annualReportKindLabels,
  yearFromPeriodLabel,
} from "@/lib/annual";
import { OPEN_STATUSES } from "@/lib/task-generator";
import { clientTypeLabels } from "@/lib/enums";
import { describeDueDate, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AnnualReportKind, TaskStatus } from "@/generated/prisma/client";

/**
 * הדוח השנתי מנוהל בשני מסלולים נפרדים: דוח מבוקר של חברה ודוח אישי של יחיד.
 * לכל מסלול תהליך שונה ומועדי אורכה נפרדים מול רשות המסים, ולכן ההפרדה
 * מלאה - כולל מועדים, שיוך והתקדמות.
 */
export default async function AnnualReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; kind?: string; ext?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const params = await searchParams;
  const ext = params.ext ?? "";

  const allAnnual = await prisma.clientTask.findMany({
    where: { taskType: "ANNUAL_REPORT", client: { status: "ACTIVE" } },
    include: {
      client: { select: { id: true, businessName: true, clientType: true } },
      annualExtension: true,
    },
    orderBy: [{ dueDate: "asc" }, { client: { businessName: "asc" } }],
  });

  const periods = ([...new Set(allAnnual.map((t) => t.periodLabel).filter(Boolean))] as string[])
    .sort()
    .reverse();
  const activePeriod = params.period || periods[0] || "";
  const activeYear = activePeriod ? yearFromPeriodLabel(activePeriod) : null;
  const suggestedYear = new Date().getUTCFullYear() - 1;

  const kind = (ANNUAL_KINDS.includes(params.kind as AnnualReportKind)
    ? params.kind
    : "COMPANY_AUDITED") as AnnualReportKind;

  const extensions = activeYear
    ? await prisma.annualExtension.findMany({
        where: { taxYear: activeYear, kind },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const forPeriod = allAnnual.filter((t) => t.periodLabel === activePeriod);
  const forKind = forPeriod.filter((t) => annualReportKind(t.client.clientType) === kind);

  const isDone = (s: TaskStatus) => !OPEN_STATUSES.includes(s);
  const doneCount = forKind.filter((t) => isDone(t.status)).length;

  const waves = extensions.map((extension) => {
    const tasks = forKind.filter((t) => t.annualExtensionId === extension.id);
    const waveDone = tasks.filter((t) => isDone(t.status)).length;
    return {
      extension,
      total: tasks.length,
      done: waveDone,
      overdue: extension.dueDate < new Date() && waveDone < tasks.length,
    };
  });
  const unassigned = forKind.filter((t) => !t.annualExtensionId);

  const visible = forKind.filter((t) =>
    ext === "" ? true : ext === "none" ? !t.annualExtensionId : t.annualExtensionId === ext,
  );

  const extensionOptions = extensions.map((e) => ({ id: e.id, name: e.name }));
  const baseQuery = `period=${encodeURIComponent(activePeriod)}&kind=${kind}`;

  // ספירה לכל מסלול, לתצוגה על הלשוניות
  const countsByKind = Object.fromEntries(
    ANNUAL_KINDS.map((k) => {
      const list = forPeriod.filter((t) => annualReportKind(t.client.clientType) === k);
      return [k, { total: list.length, done: list.filter((t) => isDone(t.status)).length }];
    }),
  ) as Record<AnnualReportKind, { total: number; done: number }>;

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">דוחות שנתיים</h1>
          <p className="text-sm text-muted-foreground">
            מסלול נפרד לדוחות מבוקרים של חברות ולדוחות אישיים של יחידים
          </p>
        </div>

        {periods.length === 0 ? (
          <Card>
            <CardContent className="space-y-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                עדיין אין דוחות שנתיים במערכת. אפשר לפתוח שנת מס לכל הלקוחות הפעילים.
              </p>
              <div className="flex justify-center">
                <CreateAnnualReportsForm defaultYear={suggestedYear} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  {periods.map((p) => (
                    <Link
                      key={p}
                      href={`/annual-reports?period=${encodeURIComponent(p)}&kind=${kind}`}
                      className={buttonVariants({
                        variant: p === activePeriod ? "default" : "outline",
                        size: "sm",
                      })}
                    >
                      {p}
                    </Link>
                  ))}
                  <span className="mx-2 h-6 w-px bg-border" />
                  <CreateAnnualReportsForm defaultYear={suggestedYear} />
                </div>

                {/* לשוניות המסלולים */}
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {ANNUAL_KINDS.map((k) => (
                    <Link
                      key={k}
                      href={`/annual-reports?period=${encodeURIComponent(activePeriod)}&kind=${k}`}
                      className={buttonVariants({
                        variant: k === kind ? "default" : "outline",
                        size: "sm",
                      })}
                    >
                      {annualReportKindLabels[k]} ({countsByKind[k].done}/
                      {countsByKind[k].total})
                    </Link>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <CycleProgress done={doneCount} total={forKind.length} />
                </div>
              </CardContent>
            </Card>

            {forKind.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  אין לקוחות במסלול {annualReportKindLabels[kind]} ל{activePeriod}.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      מועדי הגשה · {annualReportKindLabels[kind]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {waves.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        טרם הוגדרו מועדי אורכה למסלול זה. יש להוסיף את המועדים שקיבל
                        המשרד מרשות המסים ואז לשייך אליהם את הלקוחות.
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {waves.map(({ extension, total, done, overdue }) => (
                          <li
                            key={extension.id}
                            className="flex flex-wrap items-center justify-between gap-4 py-3"
                          >
                            <Link
                              href={`/annual-reports?${baseQuery}&ext=${extension.id}`}
                              className="min-w-44 flex-1"
                            >
                              <div className="font-medium hover:text-accent">
                                {extension.name}
                              </div>
                              <div
                                className={cn(
                                  "text-xs",
                                  overdue
                                    ? "font-medium text-destructive"
                                    : "text-muted-foreground",
                                )}
                              >
                                {formatDate(extension.dueDate)} ·{" "}
                                {describeDueDate(extension.dueDate)}
                              </div>
                            </Link>
                            <CycleProgress done={done} total={total} overdue={overdue} />
                            {user.role === "PARTNER" && (
                              <DeleteExtensionButton
                                extensionId={extension.id}
                                name={extension.name}
                              />
                            )}
                          </li>
                        ))}
                        {unassigned.length > 0 && (
                          <li className="flex items-center justify-between gap-4 py-3">
                            <Link
                              href={`/annual-reports?${baseQuery}&ext=none`}
                              className="font-medium text-destructive hover:underline"
                            >
                              לא שויכו למועד
                            </Link>
                            <span className="text-sm tabular-nums text-destructive">
                              {unassigned.length}
                            </span>
                          </li>
                        )}
                      </ul>
                    )}

                    {user.role === "PARTNER" && activeYear && (
                      <div className="space-y-4 border-t pt-4">
                        <AddExtensionForm taxYear={activeYear} kind={kind} />
                        {extensionOptions.length > 0 && unassigned.length > 0 && (
                          <AssignAllForm
                            periodLabel={activePeriod}
                            options={extensionOptions}
                            kind={kind}
                          />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                    <CardTitle className="text-base">לקוחות ({visible.length})</CardTitle>
                    {ext && (
                      <Link
                        href={`/annual-reports?${baseQuery}`}
                        className="text-sm text-accent hover:underline"
                      >
                        ניקוי הסינון
                      </Link>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">לקוח</TableHead>
                          <TableHead className="text-right">סוג</TableHead>
                          <TableHead className="text-right">מועד הגשה</TableHead>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">סטטוס</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visible.map((task) => (
                          <TableRow
                            key={task.id}
                            className={cn(isDone(task.status) && "opacity-60")}
                          >
                            <TableCell>
                              <Link
                                href={`/clients/${task.client.id}`}
                                className="font-medium hover:text-accent hover:underline"
                              >
                                {task.client.businessName}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {clientTypeLabels[task.client.clientType]}
                            </TableCell>
                            <TableCell>
                              <ExtensionSelect
                                taskId={task.id}
                                currentId={task.annualExtensionId}
                                options={extensionOptions}
                              />
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-sm",
                                task.dueDate < new Date() && !isDone(task.status)
                                  ? "font-medium text-destructive"
                                  : "text-muted-foreground",
                              )}
                            >
                              {formatDate(task.dueDate)}
                            </TableCell>
                            <TableCell>
                              <TaskStatusSelect taskId={task.id} status={task.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
