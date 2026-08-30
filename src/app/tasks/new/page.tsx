import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { ClientTaskForm } from "@/components/client-task-form";
import { createClientTask } from "../task-actions";

export default async function NewClientTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { client: clientId } = await searchParams;

  const [clients, users] = await Promise.all([
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

  const backHref = clientId ? `/clients/${clientId}` : "/tasks";

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-accent">
            → {clientId ? "חזרה לכרטיס הלקוח" : "חזרה לרשימת המשימות"}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">משימה חדשה</h1>
          <p className="text-sm text-muted-foreground">
            משימה שנוצרת כאן היא חד-פעמית ואינה חוזרת אוטומטית.
          </p>
        </div>

        <ClientTaskForm
          action={createClientTask}
          clients={clients}
          users={users}
          lockedClientId={clientId}
          submitLabel="יצירת משימה"
          cancelHref={backHref}
        />
      </div>
    </AppShell>
  );
}
