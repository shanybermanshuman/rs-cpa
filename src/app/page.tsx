import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { StatTile } from "@/components/stat-tile";
import { CycleProgress } from "@/components/cycle-progress";
import { getFilingCycles, getIndividualTasks } from "@/lib/filing-cycles";
import { IndividualTaskRow } from "@/components/individual-task-row";
import { OPEN_STATUSES } from "@/lib/task-generator";
import { clientTaskTypeLabel, clientTaskTypeLabels } from "@/lib/enums";
import { describeDueDate, formatDate, startOfToday } from "@/lib/dates";
import { withholdingInfo } from "@/lib/withholding";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";

const DAYS_AHEAD = 7;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const today = startOfToday();
  const weekAhead = new Date(today.getTime() + DAYS_AHEAD * 86_400_000);
  const now = new Date();
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  // שותפות רואות את כלל המשרד; עובד/ת רואה את המשימות שהוקצו לו/ה בלבד
  const scope: Prisma.ClientTaskWhereInput =
    user.role === "PARTNER" ? {} : { assigneeId: user.id };
  const openScope = { ...scope, status: { in: OPEN_STATUSES } };

  const [
    cycles,
    individualTasks,
    overdueCount,
    weekCount,
    openCount,
    activeClients,
    withholdingClients,
    myTasks,
  ] = await Promise.all([
      getFilingCycles(30),
      getIndividualTasks(10),
      prisma.clientTask.count({ where: { ...openScope, dueDate: { lt: today } } }),
      // דיווחים חוזרים שמועדם בחודש הנוכחי - אלה שבעבודה עכשיו
      prisma.clientTask.count({
        where: {
          ...openScope,
          recurrenceRuleId: { not: null },
          dueDate: { lt: monthEnd },
        },
      }),
      // "משימות פתוחות" = חד-פעמיות בלבד. דיווחים חוזרים אינם משימות והם
      // נמדדים בלוח המעקב, אחרת המספר מתנפח מדיווחים עתידיים.
      prisma.clientTask.count({
        where: { ...openScope, recurrenceRuleId: null, taskType: { not: "ANNUAL_REPORT" } },
      }),
      prisma.client.count({ where: { status: "ACTIVE" } }),
      prisma.client.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          businessName: true,
          withholdingRate: true,
          withholdingValidUntil: true,
        },
      }),
      // לעובד/ת מציגים את המשימות האישיות; לשותפה זה יהיה ריק ולא יוצג
      user.role === "PARTNER"
        ? []
        : prisma.clientTask.findMany({
            where: { ...openScope, dueDate: { lte: weekAhead } },
            include: { client: { select: { id: true, businessName: true } } },
            orderBy: { dueDate: "asc" },
            take: 20,
          }),
    ]);

  const withholdingAlerts = withholdingClients
    .map((client) => ({ client, info: withholdingInfo(client) }))
    .filter(({ info }) => info.critical)
    .sort((a, b) => (a.info.daysLeft ?? 999) - (b.info.daysLeft ?? 999))
    .slice(0, 10);

  const overdueCycles = cycles.filter((c) => c.overdue);
  const currentCycles = cycles.filter((c) => !c.overdue);
  const lateIndividual = individualTasks.filter((t) => t.dueDate < today).length;

  if (activeClients === 0 && openCount === 0) {
    return (
      <AppShell user={user}>
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium">המערכת מוכנה לשימוש</p>
            <p className="text-sm text-muted-foreground">
              עדיין אין לקוחות פעילים. לאחר הוספת לקוח וסימונו כ&quot;פעיל&quot;,
              הדיווחים השוטפים שלו ייווצרו כאן אוטומטית.
            </p>
            <div>
              <Link href="/clients/new" className={buttonVariants()}>
                הוספת לקוח ראשון
              </Link>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">לוח בקרה</h1>
          <p className="text-sm text-muted-foreground">
            שלום {user.name}
            {user.role !== "PARTNER" && " · מוצגות המשימות שהוקצו לך"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="משימות באיחור"
            value={overdueCount}
            hint={overdueCount > 0 ? "דורש טיפול מיידי" : "אין איחורים"}
            href="/tasks/all?view=overdue"
            tone="danger"
          />
          <StatTile
            label="דיווחים להגשה החודש"
            value={weekCount}
            hint="דיווחים חוזרים שהתקופה שלהם הסתיימה"
            href="/filings"
            tone="accent"
          />
          <StatTile
            label="משימות פתוחות"
            value={openCount}
            hint="משימות חד-פעמיות"
            href="/tasks"
          />
          <StatTile
            label="לקוחות פעילים"
            value={activeClients}
            href="/clients?status=ACTIVE"
          />
        </div>

        {/* מחזורי דיווח ולא משימות בודדות - עם עשרות לקוחות רשימה שטוחה
            תהיה מאות שורות ולא ניתנת למעקב */}
        <Card className={cn(overdueCycles.length > 0 && "border-destructive/40")}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base">
              {overdueCycles.length > 0 ? "⚠ דיווחים לטיפול" : "דיווחים לטיפול"}
            </CardTitle>
            <Link
              href="/filings"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              ללוח המעקב
            </Link>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {cycles.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                אין דיווחים לטיפול בתקופה הקרובה.
              </p>
            ) : (
              [...overdueCycles, ...currentCycles].slice(0, 8).map((cycle) => (
                <Link
                  key={cycle.key}
                  href="/filings"
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-muted"
                >
                  <div className="min-w-48">
                    <div className="text-sm font-medium">
                      {clientTaskTypeLabels[cycle.taskType]}
                      {cycle.periodLabel && (
                        <span className="text-muted-foreground"> · {cycle.periodLabel}</span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "text-xs",
                        cycle.overdue
                          ? "font-medium text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatDate(cycle.dueDate)} · {describeDueDate(cycle.dueDate)}
                    </div>
                  </div>
                  <CycleProgress
                    done={cycle.done}
                    total={cycle.total}
                    overdue={cycle.overdue}
                  />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {user.role !== "PARTNER" && myTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">המשימות שלי לשבוע הקרוב</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {myTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-3 text-sm transition-colors hover:bg-muted"
                >
                  <span>
                    <span className="font-medium">{task.client.businessName}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {clientTaskTypeLabel(task)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      task.dueDate < today
                        ? "font-medium text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatDate(task.dueDate)}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* משימות שנפתחו ידנית - הכי קל לשכוח אותן, ולכן הן על לוח הבקרה */}
        {individualTasks.length > 0 && (
          <Card className={cn(lateIndividual > 0 && "border-destructive/40")}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle className="text-base">
                משימות אחרות
                {lateIndividual > 0 && (
                  <span className="text-destructive"> · {lateIndividual} באיחור</span>
                )}
              </CardTitle>
              <Link
                href="/tasks"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                לכל המשימות
              </Link>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {individualTasks.map((task) => (
                <IndividualTaskRow key={task.id} task={task} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* אישור ניכוי במקור שפג גורם לניכוי מכל תשלום ללקוח - התרעה חשובה */}
        {withholdingAlerts.length > 0 && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base">⚠ אישורי ניכוי במקור</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {withholdingAlerts.map(({ client, info }) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-3 text-sm transition-colors hover:bg-muted"
                >
                  <span className="font-medium">{client.businessName}</span>
                  <span className="text-destructive">{info.label}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
