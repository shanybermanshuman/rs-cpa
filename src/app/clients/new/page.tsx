import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { ClientForm } from "@/components/client-form";
import { createClient } from "../actions";

export default async function NewClientPage() {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/clients" className="text-sm text-muted-foreground hover:text-accent">
            → חזרה לרשימת הלקוחות
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">הוספת לקוח</h1>
        </div>

        <ClientForm action={createClient} users={users} submitLabel="שמירת לקוח" />
      </div>
    </AppShell>
  );
}
