import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import {
  clientStatusLabels,
  clientTaskTypeLabel,
  clientTaskTypeLabels,
  clientTypeLabels,
  recurrenceFrequencyLabels,
  serviceTypeLabels,
  taskStatusLabels,
  vatFrequencyLabels,
} from "@/lib/enums";
import { daysUntil, formatDate } from "@/lib/dates";
import { withholdingInfo } from "@/lib/withholding";
import { summarizeClientTasks } from "@/lib/client-status";
import { OPEN_STATUSES } from "@/lib/task-generator";
import { ClientStatusPanel } from "@/components/client-status-panel";
import { ClientContacts } from "@/components/client-contacts";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

const dateFormatter = new Intl.DateTimeFormat("he-IL", { dateStyle: "long" });

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      recurrenceRules: { where: { isActive: true }, orderBy: { taskType: "asc" } },
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      // כל המשימות, כדי לחשב תמונת מצב מלאה (מה פתוח ומה כבר הוגש)
      tasks: { orderBy: { dueDate: "asc" } },
    },
  });

  if (!client) notFound();

  const wh = withholdingInfo(client);
  const summary = summarizeClientTasks(client.tasks);
  // רק משימות חד-פעמיות. הדיווחים החוזרים מסוכמים ב"מצב הלקוח" ומנוהלים
  // בלוח המעקב, והדוח השנתי מנוהל במסך הייעודי שלו - כדי שרשימה חוזרת
  // לא תציף את הכרטיס.
  const openTasks = client.tasks.filter(
    (t) =>
      OPEN_STATUSES.includes(t.status) &&
      t.recurrenceRuleId === null &&
      t.taskType !== "ANNUAL_REPORT",
  );

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/clients" className="text-sm text-muted-foreground hover:text-accent">
            → חזרה לרשימת הלקוחות
          </Link>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{client.businessName}</h1>
              <Badge>{clientStatusLabels[client.status]}</Badge>
            </div>
            <Link
              href={`/clients/${client.id}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              עריכה
            </Link>
          </div>
        </div>

        <ClientStatusPanel summary={summary} clientId={client.id} />

        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">פרטי העסק</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DetailRow label="ח.פ. / ע.מ / ת.ז" value={client.taxId} />
                <DetailRow label="סוג לקוח" value={clientTypeLabels[client.clientType]} />
                <DetailRow
                  label="סוג שירות"
                  value={
                    client.serviceType === "OTHER" && client.serviceTypeOther
                      ? `אחר · ${client.serviceTypeOther}`
                      : serviceTypeLabels[client.serviceType]
                  }
                />
                <DetailRow
                  label='תדירות מע"מ'
                  value={client.vatFrequency ? vatFrequencyLabels[client.vatFrequency] : null}
                />
              </dl>
            </CardContent>
          </Card>

          <Card className={cn(wh.critical && "border-destructive/40 bg-destructive/5")}>
            <CardHeader>
              <CardTitle className="text-base">
                ניכוי במקור
                {wh.critical && <span className="text-destructive"> ⚠</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DetailRow label="מספר תיק ניכויים" value={client.withholdingFileNumber} />
                <DetailRow
                  label="שיעור ניכוי"
                  value={
                    wh.ratePercent === null ? null : wh.ratePercent === 0 ? (
                      "פטור מניכוי במקור"
                    ) : (
                      <span className="text-destructive">{wh.ratePercent}%</span>
                    )
                  }
                />
                <DetailRow
                  label="תוקף האישור"
                  value={
                    client.withholdingValidUntil ? (
                      <span className={cn(wh.critical && "font-semibold text-destructive")}>
                        {formatDate(client.withholdingValidUntil)}
                        {wh.daysLeft !== null && ` · ${wh.label}`}
                      </span>
                    ) : null
                  }
                />
              </dl>
            </CardContent>
          </Card>

          <div className="sm:col-span-2">
            <ClientContacts clientId={client.id} contacts={client.contacts} />
          </div>

          <Card className="sm:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">התקשרות</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DetailRow label="רו״ח מטפל/ת" value={client.owner?.name} />
                <DetailRow
                  label="תאריך תחילת התקשרות"
                  value={client.engagementDate ? dateFormatter.format(client.engagementDate) : null}
                />
                <DetailRow
                  label="שכר טרחה חודשי"
                  value={client.monthlyFee ? `${Number(client.monthlyFee).toLocaleString("he-IL")} ₪` : null}
                />
                <DetailRow
                  label="תיקיית מסמכים"
                  value={
                    client.documentsFolderUrl ? (
                      <a
                        href={client.documentsFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        פתיחת התיקייה
                      </a>
                    ) : null
                  }
                />
                <DetailRow label="הערות" value={client.notes} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">דיווחים חוזרים</CardTitle>
          </CardHeader>
          <CardContent>
            {client.recurrenceRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                לא הוגדרו דיווחים חוזרים. הם נוצרים אוטומטית כשהלקוח עובר
                לסטטוס &quot;פעיל&quot;.
              </p>
            ) : (
              <ul className="space-y-2">
                {client.recurrenceRules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0"
                  >
                    <span className="font-medium">
                      {clientTaskTypeLabels[rule.taskType]}
                    </span>
                    <span className="text-muted-foreground">
                      {recurrenceFrequencyLabels[rule.frequency]} · ב-{rule.dayOfMonth} לחודש
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base">משימות חד-פעמיות</CardTitle>
            <div className="flex gap-2">
              <Link
                href={`/tasks?client=${client.id}&view=all`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                כל המשימות
              </Link>
              <Link
                href={`/tasks/new?client=${client.id}`}
                className={buttonVariants({ size: "sm" })}
              >
                משימה חדשה
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {openTasks.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                אין משימות חד-פעמיות פתוחות. הדיווחים השוטפים מוצגים למעלה
                ומנוהלים בלוח המעקב.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">משימה</TableHead>
                    <TableHead className="text-right">תקופה</TableHead>
                    <TableHead className="text-right">מועד הגשה</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="font-medium hover:text-accent hover:underline"
                        >
                          {clientTaskTypeLabel(task)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {task.periodLabel ?? "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          daysUntil(task.dueDate) < 0 && "font-semibold text-destructive",
                        )}
                      >
                        {formatDate(task.dueDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{taskStatusLabels[task.status]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
