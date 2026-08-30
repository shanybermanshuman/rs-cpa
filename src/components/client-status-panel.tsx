import Link from "next/link";
import type { ClientStatusSummary, ReportLine } from "@/lib/client-status";
import { clientTaskTypeLabels, taskStatusLabels } from "@/lib/enums";
import { describeDueDate, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * מצב הלקוח במבט אחד.
 *
 * הדיווחים החוזרים מוצגים כשורת סיכום אחת לכל סוג ("מסודר עד יולי 2026")
 * ולא כרשימת משימות חודשית - המעקב השוטף אחריהם נעשה בלוח המעקב.
 */
export function ClientStatusPanel({
  summary,
  clientId,
}: {
  summary: ClientStatusSummary;
  clientId: string;
}) {
  const { overdueCount, openCount, recurringLines, otherLines } = summary;
  const behind = recurringLines.filter((l) => l.state === "OVERDUE");
  const headline =
    overdueCount > 0
      ? `${overdueCount} באיחור`
      : openCount > 0
        ? `${openCount} להגשה החודש`
        : "הכל מסודר";

  return (
    <Card className={cn(overdueCount > 0 && "border-destructive/40 bg-destructive/5")}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">מצב הלקוח</CardTitle>
        <span
          className={cn(
            "text-sm font-semibold",
            overdueCount > 0 ? "text-destructive" : "text-accent",
          )}
        >
          {headline}
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">דיווחים שוטפים</h3>
            {/* רק ללקוח שמנוהל בלוח. ללקוח ללא דיווחים חוזרים - למשל בעל
                שליטה שמגיש דוח שנתי בלבד - אין מה להציג שם. */}
            {recurringLines.length > 0 && (
              <Link
                href={`/filings?view=client&client=${clientId}`}
                className={buttonVariants({ variant: "ghost", size: "xs" })}
              >
                ללוח המעקב של הלקוח
              </Link>
            )}
          </div>

          {recurringLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              אין דיווחים חוזרים. הם נוצרים אוטומטית כשהלקוח מסומן כ&quot;פעיל&quot;.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {recurringLines.map((line) => (
                <RecurringLine key={line.taskType} line={line} />
              ))}
            </ul>
          )}

          {behind.length > 0 && (
            <p className="mt-2 text-sm font-medium text-destructive">
              ⚠ פיגור ב־{behind.map((l) => clientTaskTypeLabels[l.taskType]).join(", ")}
            </p>
          )}
        </section>

        {otherLines.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              דוח שנתי ומשימות
            </h3>
            <ul className="divide-y rounded-md border">
              {otherLines.map((line) => (
                <RecurringLine key={line.taskType} line={line} recurring={false} />
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function RecurringLine({
  line,
  recurring = true,
}: {
  line: ReportLine;
  /**
   * דיווח חוזר שמועדו טרם הגיע נחשב "מסודר" - הוא ייווצר ממילא כל חודש.
   * משימה חד-פעמית לעומת זאת היא התחייבות ממשית גם אם מועדה עתידי,
   * ולכן היא תמיד מוצגת עם התאריך והסטטוס שלה.
   */
  recurring?: boolean;
}) {
  const period = line.openTask?.periodLabel;
  const showAsTask =
    line.state === "OVERDUE" ||
    line.state === "DUE" ||
    (!recurring && line.state === "SCHEDULED");

  const detail = showAsTask
    ? `${period ? `${period} · ` : ""}${formatDate(line.openTask!.dueDate)} · ${describeDueDate(line.openTask!.dueDate)}`
    : line.state === "SCHEDULED"
      ? `${line.lastSubmittedPeriod ? `מסודר עד ${line.lastSubmittedPeriod} · ` : ""}הבא: ${period ?? formatDate(line.openTask!.dueDate)}`
      : line.lastSubmittedPeriod
        ? `מסודר עד ${line.lastSubmittedPeriod}`
        : "אין תקופה פתוחה";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-40 flex-1">
        <div className="text-sm font-medium">{clientTaskTypeLabels[line.taskType]}</div>
        <div
          className={cn(
            "text-xs",
            line.state === "OVERDUE"
              ? "font-medium text-destructive"
              : "text-muted-foreground",
          )}
        >
          {detail}
        </div>
      </div>

      {showAsTask ? (
        <Link href={`/tasks/${line.openTask!.id}`}>
          <Badge
            variant="outline"
            className={cn(
              "transition-colors hover:border-accent",
              line.state === "OVERDUE" && "border-destructive text-destructive",
            )}
          >
            {line.state === "OVERDUE"
              ? `באיחור · ${taskStatusLabels[line.openTask!.status]}`
              : line.state === "DUE" && recurring
                ? `להגשה החודש · ${taskStatusLabels[line.openTask!.status]}`
                : taskStatusLabels[line.openTask!.status]}
          </Badge>
        </Link>
      ) : (
        <Badge className="bg-accent text-accent-foreground">מסודר ✓</Badge>
      )}
    </li>
  );
}
