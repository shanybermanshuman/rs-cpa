import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { ClientTaskForm } from "@/components/client-task-form";
import { updateClientTask } from "../../task-actions";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { id } = await params;
  const [task, clients, users] = await Promise.all([
    prisma.clientTask.findUnique({ where: { id } }),
    prisma.client.findMany({
      select: { id: true, businessName: true },
      orderBy: { businessName: "asc" },
    }),
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
          <Link href={`/tasks/${task.id}`} className="text-sm text-muted-foreground hover:text-accent">
            → חזרה למשימה
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">עריכת משימה</h1>
        </div>

        <ClientTaskForm
          action={updateClientTask.bind(null, task.id)}
          task={task}
          clients={clients}
          users={users}
          submitLabel="שמירת שינויים"
          cancelHref={`/tasks/${task.id}`}
        />
      </div>
    </AppShell>
  );
}
