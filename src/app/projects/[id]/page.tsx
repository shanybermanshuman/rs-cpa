import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import {
  AddProjectTaskForm,
  DeleteProjectButton,
  DeleteProjectTaskButton,
  ProjectForm,
  StatusSelect,
  UpdateProjectStatusForm,
} from "@/components/project-controls";
import { projectStatusLabels } from "@/lib/enums";
import { daysUntil, describeDueDate, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] },
      history: {
        include: { changedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) notFound();

  const openTasks = project.tasks.filter((t) => t.status !== "DONE");
  const doneTasks = project.tasks.filter((t) => t.status === "DONE");

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/projects" className="text-sm text-muted-foreground hover:text-accent">
            → חזרה לפרויקטים
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <Badge variant="outline">{projectStatusLabels[project.status]}</Badge>
            </div>
            <DeleteProjectButton project={project} />
          </div>
          {project.partner && (
            <p className="text-sm text-muted-foreground">בשיתוף {project.partner}</p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">שלב הפרויקט</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UpdateProjectStatusForm projectId={project.id} status={project.status} />

            <div className="border-t pt-4">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">היסטוריה</h3>
              {project.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין עדיין שינויים.</p>
              ) : (
                <ol className="space-y-2">
                  {project.history.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="tabular-nums text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </span>
                      <span className="font-medium">
                        {entry.fromStatus && entry.fromStatus !== entry.toStatus
                          ? `${projectStatusLabels[entry.fromStatus]} ← ${projectStatusLabels[entry.toStatus]}`
                          : projectStatusLabels[entry.toStatus]}
                      </span>
                      {entry.note && (
                        <span className="text-muted-foreground">· {entry.note}</span>
                      )}
                      {entry.changedBy && (
                        <span className="text-xs text-muted-foreground">
                          ({entry.changedBy.name})
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">משימות הפרויקט</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddProjectTaskForm projectId={project.id} />

            {project.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                אין עדיין משימות בפרויקט זה.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">משימה</TableHead>
                    <TableHead className="text-right">מועד</TableHead>
                    <TableHead className="text-right">שלב</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...openTasks, ...doneTasks].map((task) => {
                    const late = task.dueDate && daysUntil(task.dueDate) < 0 && task.status !== "DONE";
                    return (
                      <TableRow
                        key={task.id}
                        className={cn(task.status === "DONE" && "opacity-60")}
                      >
                        <TableCell>
                          <div className="font-medium">{task.title}</div>
                          {task.notes && (
                            <div className="text-xs text-muted-foreground">{task.notes}</div>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-sm whitespace-nowrap",
                            late ? "font-medium text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {task.dueDate ? (
                            <>
                              {formatDate(task.dueDate)}
                              {task.status !== "DONE" && (
                                <div className="text-xs">
                                  {describeDueDate(task.dueDate)}
                                </div>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusSelect id={task.id} status={task.status} kind="task" />
                        </TableCell>
                        <TableCell>
                          <DeleteProjectTaskButton task={task} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">פרטי הפרויקט</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectForm project={project} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
