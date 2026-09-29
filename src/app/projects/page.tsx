import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import {
  NewProjectSection,
  PaidToggle,
  StatusSelect,
} from "@/components/project-controls";
import { StatTile } from "@/components/stat-tile";
import { projectKindLabels, projectStatusLabels } from "@/lib/enums";
import { formatAmount } from "@/lib/format";
import type { ProjectKind, ProjectStatus } from "@/generated/prisma/client";
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
  searchParams: Promise<{ view?: string; kind?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { view = "open", kind: kindParam } = await searchParams;
  // לשונית הסוג: פרויקטים ותיקי קבלנות משנה מתנהלים באותו מסך, כדי שלא
  // יהיה עוד מקום לנהל בו את עבודת המשרד
  const kind: ProjectKind | null =
    kindParam === "PROJECT" || kindParam === "SUBCONTRACT" ? kindParam : null;

  const [projects, unpaid] = await Promise.all([
    prisma.project.findMany({
      where: {
        ...(view === "open" ? { status: { not: "DONE" as const } } : {}),
        ...(kind ? { kind } : {}),
      },
      include: {
        tasks: { orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }] },
        history: {
          include: { changedBy: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: HISTORY_PREVIEW,
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    // הגבייה נספרת **בלי הפילטר של הלשונית**: עבודה שהסתיימה וטרם שולמה
    // היא בדיוק מה שנשכח, ובלשונית "פעילים" היא הייתה יוצאת מהחישוב - כלומר
    // האריח היה מפספס את מה שנבנה בשבילו.
    prisma.project.findMany({
      where: { isPaid: false, fee: { not: null }, ...(kind ? { kind } : {}) },
      select: { fee: true, status: true },
    }),
  ]);

  // סדר השלבים נקבע כאן ולא בסדר ה-enum במסד: ערך שנוסף ל-enum קיים נדחף
  // בפוסטגרס לסוף הרשימה, ולכן תיק חדש שהתקבל היה שוקע לתחתית המסך.
  const STATUS_ORDER: ProjectStatus[] = [
    "RECEIVED",
    "IN_PROGRESS",
    "WAITING_DOCS",
    "WAITING_REPLY",
    "DONE",
  ];
  projects.sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  const openProjects = projects.filter((p) => p.status !== "DONE");
  const waiting = openProjects.filter(
    (p) => p.status === "WAITING_DOCS" || p.status === "WAITING_REPLY",
  );
  const lateTasks = openProjects.flatMap((p) =>
    p.tasks.filter((t) => t.status !== "DONE" && t.dueDate && daysUntil(t.dueDate) < 0),
  );

  const unpaidTotal = unpaid.reduce((sum, p) => sum + Number(p.fee), 0);
  const unpaidDone = unpaid.filter((p) => p.status === "DONE").length;

  const views = [
    { key: "open", label: "פעילים" },
    { key: "all", label: "הכל" },
  ];

  const kinds = [
    { key: "", label: "הכל" },
    { key: "PROJECT", label: "פרויקטים" },
    { key: "SUBCONTRACT", label: "קבלנות משנה" },
  ];

  const tabHref = (next: { view?: string; kind?: string }) => {
    const params = new URLSearchParams();
    params.set("view", next.view ?? view);
    const k = next.kind !== undefined ? next.kind : (kind ?? "");
    if (k) params.set("kind", k);
    return `/projects?${params.toString()}`;
  };

  const title = kind === "SUBCONTRACT" ? "קבלנות משנה" : "פרויקטים";

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {kind === "SUBCONTRACT"
                ? "תיקים שמשרדי רו״ח אחרים מעבירים אלינו"
                : "עבודות חד-פעמיות שאינן של לקוחות המשרד"}
            </p>
          </div>
          <NewProjectSection defaultKind={kind ?? "PROJECT"} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="עבודות פעילות" value={openProjects.length} />
          <StatTile
            label="ממתינים למסמכים או לתשובות"
            value={waiting.length}
            hint={waiting.length > 0 ? "הכדור לא אצלנו" : undefined}
          />
          <StatTile
            label="משימות באיחור"
            value={lateTasks.length}
            tone="danger"
            hint={lateTasks.length > 0 ? "בכל העבודות הפעילות" : undefined}
          />
          <StatTile
            label="ממתין לגבייה"
            value={Math.round(unpaidTotal)}
            display={`${formatAmount(Math.round(unpaidTotal))} ₪`}
            tone={unpaidDone > 0 ? "danger" : "default"}
            hint={
              unpaidDone > 0
                ? `${unpaidDone} מהן כבר הסתיימו`
                : unpaid.length > 0
                  ? `${unpaid.length} עבודות`
                  : undefined
            }
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <Link
              key={k.key}
              href={tabHref({ kind: k.key })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                (kind ?? "") === k.key
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-muted",
              )}
            >
              {k.label}
            </Link>
          ))}
          <span className="mx-1 w-px bg-border" aria-hidden />
          {views.map((v) => (
            <Link
              key={v.key}
              href={tabHref({ view: v.key })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === v.key
                  ? "bg-secondary text-secondary-foreground"
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
                          {/* בלשונית "הכל" חשוב לדעת מאיזה סוג כל שורה */}
                          {kind === null && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {projectKindLabels[project.kind]}
                            </span>
                          )}
                          {project.partner && (
                            <span className="text-sm text-muted-foreground">
                              {project.kind === "SUBCONTRACT" ? "· מאת " : "· בשיתוף "}
                              {project.partner}
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
                          {project.fee !== null && (
                            <span>
                              {" · שכר טרחה: "}
                              {formatAmount(Number(project.fee))} ₪
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
                        {project.fee !== null && <PaidToggle project={project} />}
                        <Link
                          href={`/projects/${project.id}`}
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          {project.kind === "SUBCONTRACT" ? "לכרטיס התיק" : "לכרטיס הפרויקט"}
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
