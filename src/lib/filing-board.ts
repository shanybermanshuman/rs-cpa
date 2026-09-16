import { prisma } from "@/lib/prisma";
import { OPEN_STATUSES } from "@/lib/task-generator";
import { startOfToday } from "@/lib/dates";
import {
  HEBREW_MONTHS,
  RECURRING_TASK_TYPES,
  dueDateForPeriod,
} from "@/lib/recurrence";
import { clientTaskTypeLabels } from "@/lib/enums";
import type {
  ClientTaskType,
  RecurrenceFrequency,
  TaskStatus,
} from "@/generated/prisma/client";

/**
 * לוח מעקב הדיווחים השוטפים.
 *
 * דיווח חודשי חוזר אינו "משימה" של הלקוח אלא חובה מתמשכת, ולכן הוא נמדד
 * בלוח לקוחות-מול-תקופות ולא ברשימת משימות. כך רואים בשורה אחת מי בפיגור
 * ומאיזה חודש, במקום להיקבר בעשרות שורות שחוזרות כל חודש.
 */

/** סוגי הדיווח שמנוהלים בלוח. הדוח השנתי מנוהל במסך נפרד. */
export const BOARD_TASK_TYPES = RECURRING_TASK_TYPES;

export type CellState =
  | "SUBMITTED"
  | "OPEN"
  | "OVERDUE"
  /**
   * תקופה שחלפה, שלפי כלל הדיווח של הלקוח אמורה להיות - אך אין לה שורה
   * במערכת. קורה לכל התקופות שלפני תחילת השימוש במערכת, וזה התא שמאפשר
   * לקלוט את הסכום שדווח בפועל למפרע.
   */
  | "MISSING"
  | "NONE";

/** מה שנדרש כדי ליצור דיווח למפרע לתקופה שאין לה שורה. */
export type BackfillTarget = {
  clientId: string;
  taskType: ClientTaskType;
  periodYear: number;
  periodMonth: number;
};

export type BoardCell = {
  taskId: string | null;
  state: CellState;
  status: TaskStatus | null;
  dueDate: Date | null;
  /** התקופה שהדיווח מכסה, למשל "ינואר–פברואר 2026" */
  periodLabel: string | null;
  /** סכום הדיווח בש"ח, אם הוזן */
  amount: number | null;
  /** שינוי באחוזים מול הדיווח הקודם מאותו סוג */
  changePct: number | null;
  /** ממוצע התקופות הקודמות ששימש לבדיקת הסבירות */
  prevAverage: number | null;
  /** חריגה מהותית מהממוצע - סימן מובהק לטעות בהזנה או לאירוע חריג */
  unusual: boolean;
  /** מלא רק בתא `MISSING`: הפרטים הדרושים ליצירת הדיווח למפרע */
  backfill: BackfillTarget | null;
};

export type BoardColumn = { key: string; label: string; sortAt: number };

export type BoardRow = {
  clientId: string;
  clientName: string;
  cells: Record<string, BoardCell>;
  /** התקופה המוקדמת ביותר שטרם הוגשה - לזיהוי מהיר של פיגור */
  behindSince: string | null;
};

export type FilingBoard = {
  columns: BoardColumn[];
  rows: BoardRow[];
  submitted: number;
  total: number;
};

export const EMPTY_CELL: BoardCell = {
  taskId: null,
  state: "NONE",
  status: null,
  dueDate: null,
  periodLabel: null,
  amount: null,
  changePct: null,
  prevAverage: null,
  unusual: false,
  backfill: null,
};

/** כמה תקופות אחורה נלקחות לחישוב הממוצע בבדיקת הסבירות. */
const LOOKBACK_PERIODS = 3;

/** סטייה מהממוצע שמעליה הדיווח מסומן כחריג (50%). */
const UNUSUAL_THRESHOLD = 0.5;

export type AmountStats = {
  changePct: number | null;
  prevAverage: number | null;
  unusual: boolean;
};

/** המרה בטוחה של Decimal של Prisma למספר. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(String(value));
  return Number.isFinite(n) ? n : null;
}

type AmountTask = {
  id: string;
  taskType: ClientTaskType;
  dueDate: Date;
  amount: unknown;
  client: { id: string };
  recurrenceRule?: { frequency: RecurrenceFrequency } | null;
};

/**
 * בדיקת סבירות: כל דיווח נמדד מול הדיווחים הקודמים של אותו לקוח ומאותו סוג.
 *
 * ההשוואה היא מול **ממוצע** שלוש התקופות הקודמות ולא רק מול הקודמת, כי
 * בדיווחי מע"מ יש תנודתיות טבעית בין חודשים - חריגה אמיתית היא זו שסוטה
 * מהמגמה, לא זו שגבוהה מחודש אחד נמוך במקרה.
 */
export function amountStats(tasks: AmountTask[]): Map<string, AmountStats> {
  const series = new Map<string, AmountTask[]>();
  for (const task of tasks) {
    // התדירות היא חלק מהסדרה: סכום דו-חודשי מכסה חודשיים ואינו בר-השוואה
    // לסכום חודשי. בלעדיה, כל מעבר תדירות היה מייצר סימוני חריגה שגויים.
    const key = `${task.client.id}|${task.taskType}|${task.recurrenceRule?.frequency ?? ""}`;
    const list = series.get(key);
    if (list) list.push(task);
    else series.set(key, [task]);
  }

  const stats = new Map<string, AmountStats>();

  for (const list of series.values()) {
    const ordered = [...list].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const history: number[] = [];

    for (const task of ordered) {
      const amount = toNumber(task.amount);
      if (amount === null) continue;

      const prev = history.at(-1) ?? null;
      const window = history.slice(-LOOKBACK_PERIODS);
      const prevAverage =
        window.length > 0 ? window.reduce((s, v) => s + v, 0) / window.length : null;

      stats.set(task.id, {
        changePct: prev !== null && prev > 0 ? ((amount - prev) / prev) * 100 : null,
        prevAverage,
        unusual:
          prevAverage !== null &&
          prevAverage > 0 &&
          Math.abs(amount - prevAverage) / prevAverage >= UNUSUAL_THRESHOLD,
      });

      history.push(amount);
    }
  }

  return stats;
}

function cellFrom(
  task: {
    id: string;
    status: TaskStatus;
    dueDate: Date;
    periodLabel?: string | null;
    amount?: unknown;
  },
  today: Date,
  stats?: Map<string, AmountStats>,
): BoardCell {
  const open = OPEN_STATUSES.includes(task.status);
  const stat = stats?.get(task.id);
  return {
    taskId: task.id,
    status: task.status,
    dueDate: task.dueDate,
    periodLabel: task.periodLabel ?? null,
    state: !open ? "SUBMITTED" : task.dueDate < today ? "OVERDUE" : "OPEN",
    amount: toNumber(task.amount),
    changePct: stat?.changePct ?? null,
    prevAverage: stat?.prevAverage ?? null,
    unusual: stat?.unusual ?? false,
    backfill: null,
  };
}

/**
 * תא לתקופה שחלפה ואין לה שורה במערכת.
 *
 * **אינו נספר כפיגור ואינו נכנס למונה ההתקדמות**: היעדר השורה נובע מכך
 * שהמערכת טרם הייתה בשימוש באותה תקופה, ולא מכך שהדיווח לא הוגש. ספירתו
 * כפיגור הייתה צובעת את כל תחילת השנה באדום בלי סיבה.
 */
function missingCell(target: BackfillTarget): BoardCell {
  return { ...EMPTY_CELL, state: "MISSING", backfill: target };
}

type ActiveRule = {
  taskType: ClientTaskType;
  frequency: RecurrenceFrequency;
  dayOfMonth: number;
  clientId: string;
};

/**
 * ממלא תאי `MISSING` לכל תקופה שחלפה ושכלל הדיווח של הלקוח מחייב, אך אין
 * לה שורה. זה מה שמאפשר לקלוט למפרע את הסכומים מתחילת השנה.
 */
function fillMissingCells(
  cells: Record<string, BoardCell>,
  rule: ActiveRule,
  year: number,
  today: Date,
  columnKeyOf: (periodMonth: number) => string,
) {
  for (let periodMonth = 1; periodMonth <= 12; periodMonth++) {
    const key = columnKeyOf(periodMonth);
    if (cells[key]) continue;

    const due = dueDateForPeriod(rule.frequency, rule.dayOfMonth, year, periodMonth);
    // תקופה שאינה תקפה לתדירות הזו, או שמועד ההגשה שלה טרם חלף
    if (!due || due.dueDate >= today) continue;

    cells[key] = missingCell({
      clientId: rule.clientId,
      taskType: rule.taskType,
      periodYear: year,
      periodMonth,
    });
  }
}

type BoardTask = {
  id: string;
  status: TaskStatus;
  dueDate: Date;
  client: { id: string; businessName: string };
};

function buildRows<T extends BoardTask>(
  tasks: T[],
  columnKeyOf: (task: T) => string,
  columns: BoardColumn[],
  today: Date,
  stats?: Map<string, AmountStats>,
): BoardRow[] {
  const byClient = new Map<string, BoardRow>();

  for (const task of tasks) {
    const row =
      byClient.get(task.client.id) ??
      ({
        clientId: task.client.id,
        clientName: task.client.businessName,
        cells: {},
        behindSince: null,
      } satisfies BoardRow);

    row.cells[columnKeyOf(task)] = cellFrom(task, today, stats);
    byClient.set(task.client.id, row);
  }

  // "פיגור" = רק דיווח שמועד ההגשה שלו כבר חלף. דיווח שטרם הגיע מועדו
  // אינו פיגור, גם אם עדיין לא הוגש.
  for (const row of byClient.values()) {
    for (const column of columns) {
      const cell = row.cells[column.key];
      if (cell?.state === "OVERDUE") {
        row.behindSince = column.label;
        break;
      }
    }
  }

  return [...byClient.values()].sort((a, b) =>
    a.clientName.localeCompare(b.clientName, "he"),
  );
}

function summarize(rows: BoardRow[], columns: BoardColumn[]) {
  let submitted = 0;
  let total = 0;
  for (const row of rows) {
    for (const column of columns) {
      const cell = row.cells[column.key];
      // תקופה שאין לה שורה אינה נספרת: ההתקדמות נמדדת מול מה שהמערכת
      // אמורה לנהל, ולא מול תקופות שקדמו לשימוש בה
      if (!cell || cell.state === "NONE" || cell.state === "MISSING") continue;
      total++;
      if (cell.state === "SUBMITTED") submitted++;
    }
  }
  return { submitted, total };
}

/**
 * תצוגה לפי סוג דיווח: שורות = לקוחות, עמודות = תקופות הדיווח של אותה שנה.
 * מתאים לשאלה "מי בפיגור במע\"מ ומאיזה חודש".
 */
export async function getBoardByType(
  taskType: ClientTaskType,
  year: number,
): Promise<FilingBoard> {
  const today = startOfToday();

  const all = await prisma.clientTask.findMany({
    where: {
      taskType,
      recurrenceRuleId: { not: null },
      client: { status: "ACTIVE" },
      // שנה אחורה נוספת, כדי שגם לדיווח של ינואר יהיה מול מה להשוות
      dueDate: dueRangeForPeriodYear(year, LOOKBACK_PERIODS),
    },
    select: {
      id: true,
      status: true,
      dueDate: true,
      periodLabel: true,
      taskType: true,
      amount: true,
      recurrenceRule: { select: { frequency: true } },
      client: { select: { id: true, businessName: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const stats = amountStats(all);
  // מסננים לפי התקופה שהדיווח מכסה, לא לפי מועד ההגשה
  const tasks = all.filter((t) => periodEndOf(t.dueDate).year === year);

  // עמודות = 12 חודשי השנה. לקוח חודשי ממלא את כולן, דו-חודשי ממלא את
  // חודשי סיום התקופה שלו - ושניהם יושבים באותה טבלה בלי עמודות ריקות.
  const columns: BoardColumn[] = HEBREW_MONTHS.map((label, i) => ({
    key: String(i + 1),
    label,
    sortAt: i,
  }));

  const rows = buildRows(
    tasks,
    (t) => String(periodEndOf(t.dueDate).month),
    columns,
    today,
    stats,
  );

  // כללי הדיווח הפעילים, כדי להציג גם תקופות שחלפו ואין להן שורה - ולאפשר
  // לקלוט אליהן סכום למפרע. לקוח שיש לו כלל אך אין לו אף שורה בשנה הזו
  // מקבל כאן שורה משלו, אחרת לא היה לאן להקליד.
  const rules = await prisma.recurrenceRule.findMany({
    where: { taskType, isActive: true, client: { status: "ACTIVE" } },
    select: {
      taskType: true,
      frequency: true,
      dayOfMonth: true,
      clientId: true,
      client: { select: { businessName: true } },
    },
  });

  const byClientId = new Map(rows.map((row) => [row.clientId, row]));
  for (const rule of rules) {
    let row = byClientId.get(rule.clientId);
    if (!row) {
      row = {
        clientId: rule.clientId,
        clientName: rule.client.businessName,
        cells: {},
        behindSince: null,
      };
      byClientId.set(rule.clientId, row);
      rows.push(row);
    }
    fillMissingCells(row.cells, rule, year, today, (m) => String(m));
  }

  rows.sort((a, b) => a.clientName.localeCompare(b.clientName, "he"));
  return { columns, rows, ...summarize(rows, columns) };
}

/**
 * תצוגה לפי חודש הגשה: שורות = לקוחות, עמודות = סוגי הדיווח.
 * מתאים לשאלה "מה צריך להגיש החודש ולמי זה עוד לא נעשה".
 */
export async function getBoardByMonth(
  year: number,
  month: number,
): Promise<FilingBoard> {
  const today = startOfToday();

  // התקופה של חודש X מוגשת בחודש שאחריו. נמשכות גם התקופות הקודמות,
  // כדי שבדיקת הסבירות תוכל להשוות אליהן.
  const all = await prisma.clientTask.findMany({
    where: {
      taskType: { in: BOARD_TASK_TYPES },
      recurrenceRuleId: { not: null },
      client: { status: "ACTIVE" },
      dueDate: {
        gte: new Date(Date.UTC(year, month - 2 * LOOKBACK_PERIODS, 1)),
        lt: new Date(Date.UTC(year, month + 1, 1)),
      },
    },
    select: {
      id: true,
      status: true,
      dueDate: true,
      taskType: true,
      periodLabel: true,
      amount: true,
      recurrenceRule: { select: { frequency: true } },
      client: { select: { id: true, businessName: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const stats = amountStats(all);
  const tasks = all.filter((t) => {
    const p = periodEndOf(t.dueDate);
    return p.year === year && p.month === month;
  });

  const present = new Set(tasks.map((t) => t.taskType));
  const columns: BoardColumn[] = BOARD_TASK_TYPES.filter((t) => present.has(t)).map(
    (t, i) => ({ key: t, label: clientTaskTypeLabels[t], sortAt: i }),
  );

  const rows = buildRows(tasks, (t) => t.taskType, columns, today, stats);
  return { columns, rows, ...summarize(rows, columns) };
}

/** שורה בתצוגת הלקוח: סוג דיווח אחד על פני 12 חודשי השנה. */
export type ClientBoardRow = {
  taskType: ClientTaskType;
  label: string;
  cells: Record<string, BoardCell>;
  /** סך הסכומים שהוזנו בשנה */
  total: number | null;
  /** ממוצע התקופות שהוזנו - הבסיס להשוואה מול חודש בודד */
  average: number | null;
};

export type ClientFilingBoard = {
  columns: BoardColumn[];
  rows: ClientBoardRow[];
  submitted: number;
  total: number;
  /** התקופות החריגות, לרשימת בדיקת הסבירות */
  outliers: { label: string; period: string; cell: BoardCell }[];
};

/**
 * תצוגה לפי לקוח: שורות = סוגי הדיווח שלו, עמודות = חודשי השנה.
 *
 * זו התצוגה שעונה על "מה מצב הלקוח הזה לאורך השנה" - כולל הסכומים שדווחו,
 * השינוי מול התקופה הקודמת והחריגות. שתי התצוגות האחרות עונות על שאלות
 * רוחביות (מי בפיגור במע"מ, מה צריך להגיש החודש), ולא על השאלה הזו.
 */
export async function getBoardByClient(
  clientId: string,
  year: number,
): Promise<ClientFilingBoard> {
  const today = startOfToday();

  const all = await prisma.clientTask.findMany({
    where: {
      clientId,
      taskType: { in: BOARD_TASK_TYPES },
      recurrenceRuleId: { not: null },
      dueDate: dueRangeForPeriodYear(year, LOOKBACK_PERIODS),
    },
    select: {
      id: true,
      status: true,
      dueDate: true,
      periodLabel: true,
      taskType: true,
      amount: true,
      recurrenceRule: { select: { frequency: true } },
      client: { select: { id: true, businessName: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const stats = amountStats(all);
  const tasks = all.filter((t) => periodEndOf(t.dueDate).year === year);

  const columns: BoardColumn[] = HEBREW_MONTHS.map((label, i) => ({
    key: String(i + 1),
    label,
    sortAt: i,
  }));

  const byType = new Map<ClientTaskType, ClientBoardRow>();
  for (const task of tasks) {
    const row =
      byType.get(task.taskType) ??
      ({
        taskType: task.taskType,
        label: clientTaskTypeLabels[task.taskType],
        cells: {},
        total: null,
        average: null,
      } satisfies ClientBoardRow);

    row.cells[String(periodEndOf(task.dueDate).month)] = cellFrom(task, today, stats);
    byType.set(task.taskType, row);
  }

  // תקופות שחלפו ואין להן שורה, לקליטת סכומים למפרע
  const rules = await prisma.recurrenceRule.findMany({
    where: { clientId, isActive: true, taskType: { in: BOARD_TASK_TYPES } },
    select: { taskType: true, frequency: true, dayOfMonth: true, clientId: true },
  });

  for (const rule of rules) {
    const row =
      byType.get(rule.taskType) ??
      ({
        taskType: rule.taskType,
        label: clientTaskTypeLabels[rule.taskType],
        cells: {},
        total: null,
        average: null,
      } satisfies ClientBoardRow);

    fillMissingCells(row.cells, rule, year, today, (m) => String(m));
    byType.set(rule.taskType, row);
  }

  const rows = BOARD_TASK_TYPES.filter((t) => byType.has(t)).map((t) => {
    const row = byType.get(t)!;
    const amounts = Object.values(row.cells)
      .map((c) => c.amount)
      .filter((a): a is number => a !== null);
    row.total = amounts.length > 0 ? amounts.reduce((s, v) => s + v, 0) : null;
    row.average = row.total !== null ? row.total / amounts.length : null;
    return row;
  });

  let submitted = 0;
  let total = 0;
  const outliers: ClientFilingBoard["outliers"] = [];

  for (const row of rows) {
    for (const column of columns) {
      const cell = row.cells[column.key];
      if (!cell || cell.state === "NONE" || cell.state === "MISSING") continue;
      total++;
      if (cell.state === "SUBMITTED") submitted++;
      if (cell.unusual) {
        outliers.push({ label: row.label, period: cell.periodLabel ?? column.label, cell });
      }
    }
  }

  return { columns, rows, submitted, total, outliers };
}

/** תווית התא לקורא מסך ולחלונית עזר. */
export function describeCell(cell: BoardCell, fallback: string) {
  return cell.periodLabel ?? fallback;
}

/** השנים שקיימות בפועל בנתונים, לבחירה בלוח. */
export async function getBoardYears(): Promise<number[]> {
  const range = await prisma.clientTask.aggregate({
    where: { taskType: { in: BOARD_TASK_TYPES }, recurrenceRuleId: { not: null } },
    _min: { dueDate: true },
    _max: { dueDate: true },
  });

  if (!range._min.dueDate || !range._max.dueDate) {
    return [new Date().getUTCFullYear()];
  }

  const first = range._min.dueDate.getUTCFullYear();
  const last = range._max.dueDate.getUTCFullYear();
  return Array.from({ length: last - first + 1 }, (_, i) => last - i);
}

/** הלקוחות הפעילים שיש להם דיווחים שוטפים, לבחירה בתצוגה לפי לקוח. */
export async function getFilingClients() {
  return prisma.client.findMany({
    where: {
      status: "ACTIVE",
      recurrenceRules: { some: { isActive: true, taskType: { in: BOARD_TASK_TYPES } } },
    },
    select: { id: true, businessName: true },
    orderBy: { businessName: "asc" },
  });
}

export function monthLabel(year: number, month: number) {
  return `${HEBREW_MONTHS[month - 1]} ${year}`;
}

/**
 * החודש שהדיווח **מכסה**, הנגזר ממועד ההגשה.
 *
 * במערכת הדיווח הישראלית מגישים אחרי תום התקופה: מע"מ של יולי מוגש ב-15
 * באוגוסט. הלוח מסודר לפי התקופה ולא לפי מועד ההגשה, כי כך חושבים עליו
 * במשרד ("מע\"מ של יולי"), ואחרת דיווח יולי מופיע תחת אוגוסט ומבלבל.
 */
function periodEndOf(dueDate: Date): { year: number; month: number } {
  const zeroBased = dueDate.getUTCFullYear() * 12 + dueDate.getUTCMonth() - 1;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/**
 * טווח מועדי ההגשה שמכסה את תקופות הדיווח של שנה נתונה.
 * `lookbackMonths` מרחיב אחורה כדי שיהיו נתוני השוואה לתקופות הראשונות.
 */
function dueRangeForPeriodYear(year: number, lookbackMonths = 0) {
  return {
    gte: new Date(Date.UTC(year, 1 - lookbackMonths * 2, 1)), // תקופת ינואר מוגשת בפברואר
    lt: new Date(Date.UTC(year + 1, 1, 1)), // תקופת דצמבר מוגשת בינואר שאחריו
  };
}
