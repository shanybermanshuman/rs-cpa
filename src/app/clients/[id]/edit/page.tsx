import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { ClientForm } from "@/components/client-form";
import { DeleteClient } from "@/components/delete-client";
import { updateClient } from "../../actions";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { id } = await params;
  const [client, users] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        _count: { select: { tasks: true, contacts: true, recurrenceRules: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!client) notFound();

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href={`/clients/${client.id}`}
            className="text-sm text-muted-foreground hover:text-accent"
          >
            → חזרה לכרטיס הלקוח
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">עריכת {client.businessName}</h1>
        </div>

        <ClientForm
          action={updateClient.bind(null, client.id)}
          client={client}
          users={users}
          submitLabel="שמירת שינויים"
        />

        <DeleteClient
          clientId={client.id}
          businessName={client.businessName}
          counts={{
            tasks: client._count.tasks,
            contacts: client._count.contacts,
            rules: client._count.recurrenceRules,
          }}
        />
      </div>
    </AppShell>
  );
}
