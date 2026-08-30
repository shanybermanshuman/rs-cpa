import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { NewProjectSection, StatusSelect } from "@/components/project-controls";
import { StatTile } from "@/components/stat-tile";
import { projectStatusLabels } from "@/lib/enums";
import { daysUntil, describeDueDate, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** כמה שינויי שלב אחרונים מוצגים בכרטיס במסך הראשי. */
const HISTORY_PREVIEW = 3;

/**
 * לוח הפרויקטים. פרויקטים חד-פעמיים שאינם של לקוחות המשרד - למשל עבודה
 * בשיתוף משרד רו"ח אחר - מנוהלים כאן ולא במערכת נפרדת, לפי בקשת המשרד.
 *
 * המסך הראשי מציג את כל מה שצריך כדי לדעת איפה כל פרויקט עומד: שלב, פרטים,
 * התקדמות המשימות והשינויים האחרונים - בלי להיכנס לכל פרויקט בנפרד.
 */
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { view = "open" } = await searchParams;

  const projects = await prisma.project.findMany({
    where: view === "open" ? { status: { not: "DONE" } } : {},
    include: {
      tasks: { orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }] },
      history: {
        include: { changedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: HISTORY_PREVIEW,
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const openProjects = projects.filter((p) => p.status !== "DONE");
  const waiting = openProjects.filter(
    (p) => p.status === "WAITING_DOCS" || p.status === "WAITING_REPLY",
  );
  const lateTasks = openProjects.flatMap((p) =>
    p.tasks.filter((t) => t.status !== "DONE" && t.dueDate && daysUntil(t.dueDate) < 0),
  );

  const views = [
    { key: "open", label: "פעילים" },
    { key: "all", label: "הכל" },
  ];

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">פרויקטים</h1>
            <p className="text-sm text-muted-foreground">
              עבודות חד-פעמיות שאינן של לקוחות המשרד
            </p>
          </div>
          <NewProjectSection />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="פרויקטים פעילים" value={openProjects.length} />
          <StatTile
            label="ממתינים למסמכים או לתשובות"
            value={waiting.length}
            hint={waiting.length > 0 ? "הכדור לא אצלנו" : undefined}
          />
          <StatTile
            label="משימות באיחור"
            value={lateTasks.length}
            tone="danger"
            hint={lateTasks.length > 0 ? "בכל הפרויקטים הפעילים" : undefined}
          />
        </div>

        <div className="flex gap-2">
          {views.map((v) => (
            <Link
              key={v.key}
              href={`/projects?view=${v.key}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === v.key
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-muted",
              )}
            >
              {v.label}
            </Link>
          ))}
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {view === "open"
                ? "אין פרויקטים פעילים."
                : "עדיין לא נוצרו פרויקטים."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const openTasks = project.tasks.filter((t) => t.status !== "DONE");
              const done = project.tasks.length - openTasks.length;
              const late = openTasks.filter(
                (t) => t.dueDate && daysUntil(t.dueDate) < 0,
              );
              const next = openTasks.find((t) => t.dueDate);

              return (
                <Card
                  key={project.id}
                  className={cn(late.length > 0 && "border-destructive/40")}
                >
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-52 flex-1 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <Link
                            href={`/projects/${project.id}`}
                            className="font-medium hover:text-accent hover:underline"
                          >
                            {project.name}
                          </Link>
                          {project.partner && (
                            <span className="text-sm text-muted-foreground">
                              · בשיתוף {project.partner}
                            </span>
                          )}
                        </div>
                        {project.notes && (
                          <p className="text-sm text-muted-foreground">{project.notes}</p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {project.tasks.length === 0
                            ? "אין משימות"
                            : `${done} מתוך ${project.tasks.length} משימות הושלמו`}
                          {next?.dueDate && (
                            <span
                              className={cn(
                                late.length > 0 && "font-medium text-destructive",
                              )}
                            >
                              {" · הקרובה: "}
                              {next.title} · {formatDate(next.dueDate)} ·{" "}
                              {describeDueDate(next.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <StatusSelect
                          id={project.id}
                          status={project.status}
                          kind="project"
                        />
                        <Link
                          href={`/projects/${project.id}`}
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          לכרטיס הפרויקט
                        </Link>
                      </div>
                    </div>

                    {project.history.length > 0 && (
                      <ol className="space-y-1 border-t pt-3 text-xs">
                        {project.history.map((entry) => (
                          <li
                            key={entry.id}
                            className="flex flex-wrap items-baseline gap-x-2"
                          >
                            <span className="tabular-nums text-muted-foreground">
                              {formatDate(entry.createdAt)}
                            </span>
                            <span className="font-medium">
                              {entry.fromStatus &&
                              entry.fromStatus !== entry.toStatus
                                ? `${projectStatusLabels[entry.fromStatus]} ← ${projectStatusLabels[entry.toStatus]}`
                                : projectStatusLabels[entry.toStatus]}
                            </span>
                            {entry.note && (
                              <span className="text-muted-foreground">· {entry.note}</span>
                            )}
                            {entry.changedBy && (
                              <span className="text-muted-foreground">
                                ({entry.changedBy.name})
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          שלבים: {Object.values(projectStatusLabels).join(" · ")}
        </p>
      </div>
    </AppShell>
  );
}
