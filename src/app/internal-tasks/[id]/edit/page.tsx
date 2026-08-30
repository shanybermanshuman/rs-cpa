import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { InternalTaskForm } from "@/components/internal-task-form";
import { updateInternalTask } from "../../actions";
import { Card, CardContent } from "@/components/ui/card";

export default async function EditInternalTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { id } = await params;
  const [task, users] = await Promise.all([
    prisma.internalTask.findUnique({ where: { id } }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!task) notFound();

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href="/internal-tasks"
            className="text-sm text-muted-foreground hover:text-accent"
          >
            → חזרה למשימות הפנימיות
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">עריכת משימה</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <InternalTaskForm
              action={updateInternalTask.bind(null, task.id)}
              task={task}
              users={users}
              submitLabel="שמירת שינויים"
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
