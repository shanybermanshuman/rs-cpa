import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import {
  clientTaskTypeLabels,
  recurrenceFrequencyLabels,
  userRoleLabels,
} from "@/lib/enums";
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

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  // ההגדרות משפיעות על כל המשרד, ולכן פתוחות לשותפות בלבד
  if (user.role !== "PARTNER") {
    return (
      <AppShell user={user}>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            מסך ההגדרות פתוח לשותפות המשרד בלבד.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const [users, rules] = await Promise.all([
    prisma.user.findMany({
      include: { _count: { select: { clients: true, clientTasks: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.recurrenceRule.findMany({
      where: { isActive: true },
      include: { client: { select: { id: true, businessName: true } } },
      orderBy: [{ client: { businessName: "asc" } }, { taskType: "asc" }],
    }),
  ]);

  // קיבוץ הדיווחים החוזרים לפי לקוח, לתצוגה קריאה
  const rulesByClient = new Map<string, typeof rules>();
  for (const rule of rules) {
    const list = rulesByClient.get(rule.client.id) ?? [];
    list.push(rule);
    rulesByClient.set(rule.client.id, list);
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">הגדרות</h1>
          <p className="text-sm text-muted-foreground">
            משתמשי המשרד והדיווחים החוזרים שמוגדרים ללקוחות.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">משתמשי המשרד</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">מייל</TableHead>
                  <TableHead className="text-right">תפקיד</TableHead>
                  <TableHead className="text-right">לקוחות</TableHead>
                  <TableHead className="text-right">משימות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell dir="ltr" className="text-right text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{userRoleLabels[u.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u._count.clients}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u._count.clientTasks}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              דיווחים חוזרים ({rules.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                עדיין לא הוגדרו דיווחים חוזרים. הם נוצרים אוטומטית לכל לקוח שמסומן
                כ&quot;פעיל&quot;, לפי סוג הלקוח ותדירות דיווח המע&quot;מ שלו.
              </p>
            ) : (
              <ul className="space-y-4">
                {[...rulesByClient.entries()].map(([clientId, clientRules]) => (
                  <li key={clientId} className="border-b pb-4 last:border-0 last:pb-0">
                    <Link
                      href={`/clients/${clientId}`}
                      className="font-medium hover:text-accent hover:underline"
                    >
                      {clientRules[0].client.businessName}
                    </Link>
                    <ul className="mt-1 space-y-1">
                      {clientRules.map((rule) => (
                        <li
                          key={rule.id}
                          className="flex justify-between gap-4 text-sm text-muted-foreground"
                        >
                          <span>{clientTaskTypeLabels[rule.taskType]}</span>
                          <span>
                            {recurrenceFrequencyLabels[rule.frequency]} · ב-
                            {rule.dayOfMonth} לחודש
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">איך נוצרות המשימות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              המערכת יוצרת אוטומטית את המשימות הסטטוטוריות של כל לקוח פעיל, שלושה
              חודשים קדימה. הריצה מתבצעת מדי יום, ובנוסף מיד עם הוספת לקוח או
              עדכונו.
            </p>
            <p>
              העיקרון: הדיווח מוגש <span className="font-medium text-foreground">אחרי</span>{" "}
              תום תקופת הדיווח. לכן דיווח מע&quot;מ לחודש ינואר מופיע עם מועד הגשה
              ב-15 בפברואר.
            </p>
            <p>
              משימה חד-פעמית שאינה חלק מהדיווחים החוזרים אפשר להוסיף ידנית מכרטיס
              הלקוח או ממסך המשימות.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
