import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { clientStatusLabels, clientTypeLabels, toOptions, vatFrequencyLabels } from "@/lib/enums";
import { CLIENT_FORMS, countLabel } from "@/lib/hebrew";
import { withholdingInfo } from "@/lib/withholding";
import { getTaskCountsByClient } from "@/lib/client-status";
import { escapeLike, phoneSearchDigits } from "@/lib/search";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * סימון מהיר של מה שממתין לטיפול. דיווחים שמועדם טרם הגיע אינם נספרים,
 * כדי שלקוח מסודר לא ייראה עמוס.
 */
function ClientTasksCell({ counts }: { counts?: { actionable: number; overdue: number } }) {
  if (!counts || counts.actionable === 0) {
    return <span className="text-sm text-accent">מסודר</span>;
  }

  if (counts.overdue > 0) {
    return (
      <span className="text-sm font-medium whitespace-nowrap text-destructive">
        {counts.overdue} באיחור
      </span>
    );
  }

  return (
    <span className="text-sm whitespace-nowrap text-muted-foreground">
      {counts.actionable} להגשה החודש
    </span>
  );
}

/**
 * איש הקשר הראשי, עם קישורי חיוג ומייל ישירים - זו הפעולה שנעשית מהרשימה
 * בפועל, ולכן היא לא צריכה לדרוש כניסה לכרטיס הלקוח.
 *
 * הטלפון והמייל מוצגים עם אייקון ובכיוון LTR: מספר טלפון וכתובת מייל אינם
 * עברית, ובלי כיוון מפורש הם נשברים בתצוגת RTL.
 */
function PrimaryContactCell({
  contact,
}: {
  contact?: { name: string; role: string | null; phone: string | null; email: string | null };
}) {
  if (!contact) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium whitespace-nowrap">
        {contact.name}
        {contact.role && (
          <span className="font-normal text-muted-foreground"> · {contact.role}</span>
        )}
      </div>
      {contact.phone && (
        <a
          href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-accent"
          title="חיוג"
        >
          <Phone className="size-3.5 shrink-0" aria-hidden />
          <span dir="ltr" className="tabular-nums">
            {contact.phone}
          </span>
        </a>
      )}
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-accent"
          title="שליחת מייל"
        >
          <Mail className="size-3.5 shrink-0" aria-hidden />
          <span dir="ltr">{contact.email}</span>
        </a>
      )}
    </div>
  );
}

const statusVariant: Record<string, string> = {
  ACTIVE: "bg-accent text-accent-foreground",
  ONBOARDING: "bg-secondary text-secondary-foreground",
  INACTIVE: "bg-muted text-muted-foreground",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const { q = "", status = "" } = await searchParams;

  const taskCounts = await getTaskCountsByClient();

  // חיפוש טקסט: מנטרלים את תווי הג'וקר של LIKE, אחרת הקלדת "%" מחזירה
  // את כל הלקוחות במקום כלום.
  const term = escapeLike(q);

  // חיפוש טלפון מתעלם מפורמט: המספר נשמר כפי שהוקלד (עם או בלי מקפים,
  // רווחים או קידומת בינלאומית), ולכן ההשוואה נעשית על הספרות המנורמלות
  // בלבד — אותו נרמול משני צדי ההשוואה.
  const phoneDigits = phoneSearchDigits(q);
  const phoneMatchIds =
    phoneDigits.length >= 3
      ? (
          await prisma.$queryRaw<{ clientId: string }[]>`
            SELECT DISTINCT "clientId" FROM "client_contacts"
            WHERE regexp_replace(
                    regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g'),
                    '^(00)?972', '0'
                  ) LIKE ${`%${phoneDigits}%`}
          `
        ).map((r) => r.clientId)
      : [];

  const clients = await prisma.client.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { businessName: { contains: term, mode: "insensitive" as const } },
              { taxId: { contains: term } },
              { withholdingFileNumber: { contains: term } },
              // חיפוש גם לפי פרטי איש קשר, כי הם מוצגים ברשימה
              { contacts: { some: { name: { contains: term, mode: "insensitive" as const } } } },
              { contacts: { some: { email: { contains: term, mode: "insensitive" as const } } } },
              ...(phoneMatchIds.length > 0 ? [{ id: { in: phoneMatchIds } }] : []),
            ],
          }
        : {}),
      ...(status ? { status: status as "ACTIVE" | "INACTIVE" | "ONBOARDING" } : {}),
    },
    include: {
      owner: { select: { name: true } },
      // איש הקשר הראשי. אם לא סומן אחד - הוותיק ביותר, כדי שהעמודה
      // לא תישאר ריקה ללקוח שיש לו אנשי קשר אך אף אחד לא סומן.
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: { name: true, role: true, phone: true, email: true },
      },
    },
    orderBy: { businessName: "asc" },
  });

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">לקוחות</h1>
            <p className="text-sm text-muted-foreground">
              {countLabel(clients.length, CLIENT_FORMS)}{" "}
              {q || status ? "תואמים לסינון" : "במערכת"}
            </p>
          </div>
          <Link href="/clients/new" className={buttonVariants()}>
            הוספת לקוח
          </Link>
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* טופס GET רגיל - הסינון נשמר ב-URL וניתן לשיתוף/רענון */}
            <form className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-52 space-y-2">
                <label htmlFor="q" className="text-sm font-medium">
                  חיפוש
                </label>
                <Input
                  id="q"
                  name="q"
                  defaultValue={q}
                  placeholder="שם עסק, איש קשר, טלפון, מייל או ח.פ."
                />
              </div>
              <div className="w-44 space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  סטטוס
                </label>
                <NativeSelect id="status" name="status" defaultValue={status}>
                  <option value="">הכל</option>
                  {toOptions(clientStatusLabels).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="submit" variant="outline">
                סינון
              </Button>
              {(q || status) && (
                <Link href="/clients" className={buttonVariants({ variant: "ghost" })}>
                  ניקוי
                </Link>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {clients.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {q || status
                  ? "לא נמצאו לקוחות התואמים לסינון."
                  : "אין עדיין לקוחות במערכת. אפשר להוסיף לקוח ראשון."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  {/* עמודות מאוחדות במכוון: תשע עמודות דחקו את שם העסק -
                      הדבר החשוב ביותר ברשימה - אל מחוץ למסך. */}
                  <TableRow>
                    <TableHead className="text-right">לקוח</TableHead>
                    <TableHead className="text-right">איש קשר ראשי</TableHead>
                    <TableHead className="text-right">סוג ודיווח</TableHead>
                    <TableHead className="text-right">ניכוי במקור</TableHead>
                    <TableHead className="text-right">משימות</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => {
                    const wh = withholdingInfo(client);
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="align-top">
                          <Link
                            href={`/clients/${client.id}`}
                            className="font-medium hover:text-accent hover:underline"
                          >
                            {client.businessName}
                          </Link>
                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            <div className="whitespace-nowrap">
                              ח.פ.{" "}
                              <span dir="ltr" className="tabular-nums">
                                {client.taxId ?? "—"}
                              </span>
                            </div>
                            {client.withholdingFileNumber && (
                              <div className="whitespace-nowrap">
                                תיק ניכויים{" "}
                                <span dir="ltr" className="tabular-nums">
                                  {client.withholdingFileNumber}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <PrimaryContactCell contact={client.contacts[0]} />
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap">
                          <div className="text-sm">{clientTypeLabels[client.clientType]}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {client.vatFrequency
                              ? `מע"מ ${vatFrequencyLabels[client.vatFrequency]}`
                              : "טרם הוגדרה תדירות מע״מ"}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <span
                            className={cn(
                              "text-sm whitespace-nowrap",
                              wh.critical
                                ? "font-medium text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            {wh.label}
                          </span>
                        </TableCell>
                        <TableCell className="align-top">
                          <ClientTasksCell counts={taskCounts.get(client.id)} />
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge className={statusVariant[client.status]}>
                            {clientStatusLabels[client.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
