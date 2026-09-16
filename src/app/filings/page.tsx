import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NoAccessNotice } from "@/components/no-access-notice";
import { CycleProgress } from "@/components/cycle-progress";
import { FilingBoardCell } from "@/components/filing-board-cell";
import { formatAmount } from "@/lib/format";
import { FilingClientSelect } from "@/components/filing-client-select";
import {
  BOARD_TASK_TYPES,
  EMPTY_CELL,
  getBoardByClient,
  getBoardByMonth,
  getBoardByType,
  getBoardYears,
  getFilingClients,
  monthLabel,
  type ClientFilingBoard,
  type FilingBoard,
} from "@/lib/filing-board";
import { clientTaskTypeLabels } from "@/lib/enums";
import { HEBREW_MONTHS } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientTaskType } from "@/generated/prisma/client";

/**
 * לוח מעקב הדיווחים השוטפים - המסך היחיד למעקב אחר דיווחים חוזרים.
 * שלוש תצוגות: לפי סוג דיווח (על פני השנה), לפי חודש (כל הסוגים),
 * ולפי לקוח (כל הסוגים על פני השנה, עם סכומים והשוואה בין תקופות).
 */
export default async function FilingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    type?: string;
    year?: string;
    month?: string;
    client?: string;
    amounts?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <NoAccessNotice />;

  const params = await searchParams;
  const now = new Date();
  const years = await getBoardYears();

  const view =
    params.view === "month" ? "month" : params.view === "client" ? "client" : "type";
  const year = Number(params.year) || years[0] || now.getUTCFullYear();
  const type = (BOARD_TASK_TYPES.includes(params.type as ClientTaskType)
    ? params.type
    : "VAT") as ClientTaskType;
  const month = Number(params.month) || now.getUTCMonth() + 1;

  const clients = view === "client" ? await getFilingClients() : [];
  const requested = params.client
    ? (clients.find((c) => c.id === params.client) ?? null)
    : null;
  // לקוח שנתבקש ואינו מנוהל בלוח - נאמר זאת במפורש במקום להציג בשקט
  // את הלקוח הראשון ברשימה, שזו טעות שקשה לשים לב אליה
  const notOnBoard = Boolean(params.client && !requested);
  const clientId = requested?.id ?? clients[0]?.id ?? null;
  const selectedClient = clients.find((c) => c.id === clientId);

  // בתצוגת הלקוח הסכומים הם העיקר, ולכן הם מוצגים תמיד
  const showAmounts = view === "client" || params.amounts === "1";

  const board =
    view === "month" ? await getBoardByMonth(year, month) : view === "type"
      ? await getBoardByType(type, year)
      : null;
  const clientBoard =
    view === "client" && clientId ? await getBoardByClient(clientId, year) : null;

  const behindCount = board?.rows.filter((r) => r.behindSince).length ?? 0;
  const submitted = board?.submitted ?? clientBoard?.submitted ?? 0;
  const totalCells = board?.total ?? clientBoard?.total ?? 0;

  const query: Record<string, string> = {
    view,
    year: String(year),
    type,
    month: String(month),
    ...(clientId ? { client: clientId } : {}),
    ...(params.amounts === "1" ? { amounts: "1" } : {}),
  };

  const link = (next: Record<string, string | number>) => {
    const q = new URLSearchParams({
      ...query,
      ...Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v)])),
    });
    return `/filings?${q.toString()}`;
  };

  const views = [
    { key: "type", label: "לפי סוג דיווח" },
    { key: "month", label: "לפי חודש" },
    { key: "client", label: "לפי לקוח" },
  ];

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">מעקב דיווחים</h1>
            <p className="text-sm text-muted-foreground">
              לחיצה על תא מסמנת שהדיווח הוגש
            </p>
          </div>
          <div className="flex gap-2">
            {views.map((v) => (
              <Link
                key={v.key}
                href={link({ view: v.key })}
                className={buttonVariants({
                  variant: view === v.key ? "default" : "outline",
                  size: "sm",
                })}
              >
                {v.label}
              </Link>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            {view === "type" && (
              <div className="flex flex-wrap gap-2">
                {BOARD_TASK_TYPES.map((t) => (
                  <Link
                    key={t}
                    href={link({ type: t })}
                    className={buttonVariants({
                      variant: t === type ? "default" : "outline",
                      size: "sm",
                    })}
                  >
                    {clientTaskTypeLabels[t]}
                  </Link>
                ))}
              </div>
            )}
            {view === "month" && (
              <div className="flex flex-wrap gap-1">
                {HEBREW_MONTHS.map((label, i) => (
                  <Link
                    key={label}
                    href={link({ month: i + 1 })}
                    className={buttonVariants({
                      variant: i + 1 === month ? "default" : "outline",
                      size: "sm",
                    })}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
            {view === "client" && clients.length > 0 && clientId && (
              <div className="space-y-2">
                <FilingClientSelect clients={clients} value={clientId} query={query} />
                {notOnBoard && (
                  <p className="text-sm text-destructive">
                    הלקוח שביקשת אינו מנוהל בלוח הדיווחים (אין לו דיווחים חוזרים
                    פעילים). מוצג כאן הלקוח הראשון ברשימה.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {years.map((y) => (
                  <Link
                    key={y}
                    href={link({ year: y })}
                    className={buttonVariants({
                      variant: y === year ? "secondary" : "ghost",
                      size: "sm",
                    })}
                  >
                    {y}
                  </Link>
                ))}
                {view !== "client" && (
                  <Link
                    href={
                      params.amounts === "1"
                        ? link({ amounts: "" })
                        : link({ amounts: "1" })
                    }
                    className={cn(
                      buttonVariants({
                        variant: params.amounts === "1" ? "secondary" : "ghost",
                        size: "sm",
                      }),
                      "ms-2",
                    )}
                  >
                    {params.amounts === "1" ? "הסתרת סכומים" : "הצגת סכומים"}
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {behindCount > 0 && (
                  <span className="text-sm font-medium text-destructive">
                    {behindCount} לקוחות בפיגור
                  </span>
                )}
                <CycleProgress
                  done={submitted}
                  total={totalCells}
                  overdue={behindCount > 0}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {view === "type"
                ? `${clientTaskTypeLabels[type]} · ${year}`
                : view === "month"
                  ? monthLabel(year, month)
                  : `${selectedClient?.businessName ?? "לקוח"} · ${year}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {board && <BoardTable board={board} showAmounts={showAmounts} />}
            {view === "client" &&
              (clientBoard ? (
                <ClientBoardTable
                  board={clientBoard}
                  clientName={selectedClient?.businessName ?? ""}
                />
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  אין לקוחות פעילים עם דיווחים שוטפים.
                </p>
              ))}
          </CardContent>
        </Card>

        {clientBoard && <ReasonablenessPanel board={clientBoard} />}

        <p className="text-center text-xs text-muted-foreground">
          <span className="text-accent">✓</span> הוגש ·{" "}
          <span>○</span> טרם הוגש ·{" "}
          <span className="text-destructive">!</span> באיחור ·{" "}
          <span className="text-muted-foreground/60">·</span> לא רלוונטי
          {showAmounts && (
            <>
              {" · "}
              <span className="text-destructive">⚠</span> חריגה מהתקופות הקודמות
              {" · "}
              <span>–</span> תקופה שקדמה לשימוש במערכת, אפשר לקלוט לה סכום
            </>
          )}
        </p>
      </div>
    </AppShell>
  );
}

function BoardTable({
  board,
  showAmounts,
}: {
  board: FilingBoard;
  showAmounts: boolean;
}) {
  if (board.rows.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        אין דיווחים לתקופה זו. דיווחים נוצרים אוטומטית ללקוחות פעילים.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="sticky right-0 z-10 bg-card p-3 text-right font-medium">
              לקוח
            </th>
            {board.columns.map((c) => (
              <th key={c.key} className="p-2 text-center font-medium whitespace-nowrap">
                {c.label}
              </th>
            ))}
            <th className="p-3 text-right font-medium whitespace-nowrap">פיגור מ־</th>
          </tr>
        </thead>
        <tbody>
          {board.rows.map((row) => (
            <tr key={row.clientId} className="border-b last:border-0 hover:bg-muted/50">
              <th
                scope="row"
                className="sticky right-0 z-10 bg-card p-3 text-right font-normal"
              >
                <Link
                  href={`/clients/${row.clientId}`}
                  className="font-medium hover:text-accent hover:underline"
                >
                  {row.clientName}
                </Link>
              </th>
              {board.columns.map((c) => (
                <td key={c.key} className="p-1 text-center align-top">
                  <FilingBoardCell
                    cell={row.cells[c.key] ?? EMPTY_CELL}
                    label={`${row.clientName} · ${c.label}`}
                    showAmount={showAmounts}
                  />
                </td>
              ))}
              <td
                className={cn(
                  "p-3 whitespace-nowrap",
                  row.behindSince ? "font-medium text-destructive" : "text-muted-foreground",
                )}
              >
                {row.behindSince ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** תצוגת הלקוח: שורה לכל סוג דיווח, עמודה לכל חודש, עם סכומים וסיכום שנתי. */
function ClientBoardTable({
  board,
  clientName,
}: {
  board: ClientFilingBoard;
  clientName: string;
}) {
  if (board.rows.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        אין דיווחים שוטפים ללקוח זה בשנה שנבחרה.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="sticky right-0 z-10 bg-card p-3 text-right font-medium">
              סוג דיווח
            </th>
            {board.columns.map((c) => (
              <th key={c.key} className="p-2 text-center font-medium whitespace-nowrap">
                {c.label}
              </th>
            ))}
            <th className="p-3 text-center font-medium whitespace-nowrap">סה״כ שנתי</th>
            <th className="p-3 text-center font-medium whitespace-nowrap">ממוצע</th>
          </tr>
        </thead>
        <tbody>
          {board.rows.map((row) => (
            <tr key={row.taskType} className="border-b last:border-0 hover:bg-muted/50">
              <th
                scope="row"
                className="sticky right-0 z-10 bg-card p-3 text-right font-medium whitespace-nowrap"
              >
                {row.label}
              </th>
              {board.columns.map((c) => (
                <td key={c.key} className="p-1 text-center align-top">
                  <FilingBoardCell
                    cell={row.cells[c.key] ?? EMPTY_CELL}
                    label={`${clientName} · ${row.label} · ${c.label}`}
                    showAmount
                  />
                </td>
              ))}
              <td className="p-3 text-center tabular-nums whitespace-nowrap">
                {row.total === null ? "—" : `${formatAmount(row.total)} ₪`}
              </td>
              <td className="p-3 text-center tabular-nums whitespace-nowrap text-muted-foreground">
                {row.average === null ? "—" : `${formatAmount(Math.round(row.average))} ₪`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * בדיקת סבירות: התקופות שסכומן חורג מהותית מהתקופות שקדמו להן.
 * זה מה שמאתר טעות הזנה או אירוע חריג שדורש הסבר, בלי לעבור ידנית על הטבלה.
 */
function ReasonablenessPanel({ board }: { board: ClientFilingBoard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">בדיקת סבירות</CardTitle>
      </CardHeader>
      <CardContent>
        {board.outliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            אין חריגות. סכום נבדק מול ממוצע שלוש התקופות הקודמות, וחריגה של 50%
            ומעלה מסומנת כאן.
          </p>
        ) : (
          <ul className="space-y-2">
            {board.outliers.map((o) => (
              <li
                key={o.cell.taskId}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b pb-2 text-sm last:border-0 last:pb-0"
              >
                <span className="font-medium">
                  {o.label} · {o.period}
                </span>
                <span className="tabular-nums">
                  {o.cell.amount !== null && `${formatAmount(o.cell.amount)} ₪`}
                  {o.cell.prevAverage !== null && (
                    <span className="text-muted-foreground">
                      {" מול ממוצע "}
                      {formatAmount(Math.round(o.cell.prevAverage))} ₪
                    </span>
                  )}
                  {o.cell.changePct !== null && (
                    <span className="ms-2 font-medium text-destructive">
                      {o.cell.changePct > 0 ? "+" : ""}
                      {Math.round(o.cell.changePct)}%
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
