import type {
  ClientTaskType,
  RecurrenceFrequency,
  VatFrequency,
  Client,
} from "@/generated/prisma/client";

export const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

/**
 * באילו חודשים חל מועד הגשה, לפי תדירות הדיווח.
 *
 * העיקרון: הדיווח מוגש *אחרי* תום תקופת הדיווח. לדוגמה, מע"מ דו-חודשי
 * לתקופה ינואר-פברואר מוגש עד ה-15 במרץ, ולכן חודשי ההגשה הם האי-זוגיים.
 */
const DUE_MONTHS: Record<RecurrenceFrequency, number[]> = {
  MONTHLY: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  BIMONTHLY: [1, 3, 5, 7, 9, 11],
  QUARTERLY: [1, 4, 7, 10],
  YEARLY: [4], // הדוח השנתי מוגש באפריל של השנה העוקבת
};

export type GeneratedTask = {
  dueDate: Date;
  periodLabel: string;
};

/** מספר הימים בחודש נתון (month הוא 1-12). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** מזיז חודשים אחורה ומחזיר { year, month } כאשר month הוא 1-12. */
function subtractMonths(year: number, month: number, count: number) {
  const zeroBased = year * 12 + (month - 1) - count;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/**
 * התקופה שהמשימה מדווחת עליה, בהינתן חודש ההגשה.
 * למשל הגשה במרץ 2026 בתדירות דו-חודשית מכסה את ינואר-פברואר 2026.
 */
export function periodLabelFor(
  frequency: RecurrenceFrequency,
  dueYear: number,
  dueMonth: number,
): string {
  switch (frequency) {
    case "MONTHLY": {
      const p = subtractMonths(dueYear, dueMonth, 1);
      return `${HEBREW_MONTHS[p.month - 1]} ${p.year}`;
    }
    case "BIMONTHLY": {
      const end = subtractMonths(dueYear, dueMonth, 1);
      const start = subtractMonths(dueYear, dueMonth, 2);
      return `${HEBREW_MONTHS[start.month - 1]}–${HEBREW_MONTHS[end.month - 1]} ${end.year}`;
    }
    case "QUARTERLY": {
      const end = subtractMonths(dueYear, dueMonth, 1);
      const quarter = Math.floor((end.month - 1) / 3) + 1;
      return `רבעון ${quarter} ${end.year}`;
    }
    case "YEARLY":
      return `שנת ${dueYear - 1}`;
  }
}

/**
 * מועד ההגשה של תקופה נתונה, בכיוון ההפוך ל-`periodLabelFor`.
 *
 * משמש לקליטת דיווחים למפרע: בהינתן "מע\"מ של מרץ 2026" מחזיר את מועד
 * ההגשה (15 באפריל 2026) ואת תווית התקופה, כך שהשורה שנוצרת זהה לחלוטין
 * לשורה שמנוע המשימות היה יוצר בעצמו - כולל האינדקס הייחודי שמונע כפילות.
 *
 * מחזיר null כשהתקופה אינה תקפה לתדירות הזו, למשל תקופה של חודש בודד
 * ללקוח שמדווח דו-חודשי.
 */
export function dueDateForPeriod(
  frequency: RecurrenceFrequency,
  dayOfMonth: number,
  periodYear: number,
  periodMonth: number,
): GeneratedTask | null {
  if (periodMonth < 1 || periodMonth > 12) return null;

  const dueYear = periodMonth === 12 ? periodYear + 1 : periodYear;
  const dueMonth = periodMonth === 12 ? 1 : periodMonth + 1;

  if (!DUE_MONTHS[frequency].includes(dueMonth)) return null;

  const day = Math.min(dayOfMonth, daysInMonth(dueYear, dueMonth));
  return {
    dueDate: new Date(Date.UTC(dueYear, dueMonth - 1, day)),
    periodLabel: periodLabelFor(frequency, dueYear, dueMonth),
  };
}

/**
 * מחשב את מועדי ההגשה של כלל חזרה בטווח זמן נתון.
 *
 * @param frequency תדירות הדיווח
 * @param dayOfMonth היום בחודש בו חל מועד ההגשה (יקוצר אם החודש קצר יותר)
 * @param from ממתי להתחיל לחשב (כולל)
 * @param monthsAhead כמה חודשים קדימה לייצר
 */
export function dueDatesInRange(
  frequency: RecurrenceFrequency,
  dayOfMonth: number,
  from: Date,
  monthsAhead: number,
): GeneratedTask[] {
  const result: GeneratedTask[] = [];
  const dueMonths = DUE_MONTHS[frequency];

  let year = from.getUTCFullYear();
  let month = from.getUTCMonth() + 1;

  for (let i = 0; i <= monthsAhead; i++) {
    if (dueMonths.includes(month)) {
      const day = Math.min(dayOfMonth, daysInMonth(year, month));
      const dueDate = new Date(Date.UTC(year, month - 1, day));

      // מדלגים על מועדים שכבר חלפו לפני תחילת הטווח
      if (dueDate >= new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))) {
        result.push({ dueDate, periodLabel: periodLabelFor(frequency, year, month) });
      }
    }

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return result;
}

/**
 * סוגי הדיווח השוטפים - המקור היחיד לרשימה הזו במערכת.
 *
 * הם מנוהלים בלוח המעקב ולא כמשימות. הרשימה הייתה מוגדרת בעבר בשלושה קבצים
 * נפרדים, וכל סוג חדש שנוסף רק לאחד מהם היה נעלם בשקט מכרטיס הלקוח או מלוח
 * הבקרה. הדוח השנתי אינו כאן: הוא מנוהל במסך נפרד לפי גלי אורכות.
 */
export const RECURRING_TASK_TYPES: ClientTaskType[] = [
  "VAT",
  "INCOME_TAX_ADVANCE",
  "NATIONAL_INSURANCE",
  "WITHHOLDING_TAX",
  "WITHHOLDING_NI",
  "QUARTERLY_PL_REPORT",
];

export type DefaultRule = {
  taskType: ClientTaskType;
  frequency: RecurrenceFrequency;
  dayOfMonth: number;
};

/**
 * סט כללי החזרה הסטטוטוריים של הלקוח.
 *
 * **נגזר מבחירות מפורשות בכרטיס הלקוח ולא מסוג הלקוח.** בעבר מקדמות מס
 * הכנסה וביטוח לאומי נפתחו אוטומטית לפי סוג הלקוח, וזה לא תאם את המציאות:
 * לא לכל לקוח יש מקדמות, ומנגד עוסק פטור או בעל שליטה שמוגש להם דוח שנתי
 * בלבד יכולים בהחלט להיות חייבים במקדמות ובביטוח לאומי - והמערכת חסמה זאת.
 *
 * מה שכן נשאר נגזר, כי הוא נכון בהגדרה ולא לפי בחירה:
 * - **מע"מ** אינו נפתח לעוסק פטור ולבעל שליטה. לעוסק פטור אין דיווח מע"מ
 *   מעצם הגדרתו, ולבעל שליטה אין תיק עוסק כלל.
 * - **דוח רווח והפסד רבעוני** נכלל בחבילת השירות המלא.
 */
export function defaultRulesForClient(
  client: Pick<
    Client,
    | "clientType"
    | "serviceType"
    | "vatFrequency"
    | "hasEmployees"
    | "withholdingFrequency"
    | "tracksIncomeTaxAdvance"
    | "tracksNationalInsurance"
  >,
): DefaultRule[] {
  const annualReport: DefaultRule = {
    taskType: "ANNUAL_REPORT",
    frequency: "YEARLY",
    dayOfMonth: 30,
  };

  // ניכויי שכר מדווחים לשתי רשויות - מס הכנסה וביטוח לאומי - ונעקבים בנפרד:
  // אחד יכול להיות מדווח כשהשני עדיין לא, ולכל אחד סכום משלו.
  // מעסיק קטן מדווח ניכויי מס הכנסה דו-חודשי; ניכויי ביטוח לאומי תמיד חודשיים.
  const withholdingRules: DefaultRule[] = [
    {
      taskType: "WITHHOLDING_TAX",
      frequency: client.withholdingFrequency === "BIMONTHLY" ? "BIMONTHLY" : "MONTHLY",
      dayOfMonth: 15,
    },
    { taskType: "WITHHOLDING_NI", frequency: "MONTHLY", dayOfMonth: 15 },
  ];

  const rules: DefaultRule[] = [];

  const vatFrequencyMap: Record<VatFrequency, RecurrenceFrequency> = {
    MONTHLY: "MONTHLY",
    BIMONTHLY: "BIMONTHLY",
  };

  // מע"מ: רק ללקוח שהוגדרה לו תדירות, ולעולם לא לעוסק פטור או לבעל שליטה -
  // לראשון אין דיווח מע"מ מעצם הגדרתו, ולשני אין תיק עוסק
  const vatApplies =
    client.clientType !== "EXEMPT_DEALER" &&
    client.clientType !== "CONTROLLING_SHAREHOLDER";

  if (client.vatFrequency && vatApplies) {
    rules.push({
      taskType: "VAT",
      frequency: vatFrequencyMap[client.vatFrequency],
      dayOfMonth: 15,
    });
  }

  // מקדמות מס הכנסה וביטוח לאומי - בחירה מפורשת בכרטיס הלקוח
  if (client.tracksIncomeTaxAdvance) {
    rules.push({ taskType: "INCOME_TAX_ADVANCE", frequency: "MONTHLY", dayOfMonth: 15 });
  }

  if (client.tracksNationalInsurance) {
    rules.push({ taskType: "NATIONAL_INSURANCE", frequency: "MONTHLY", dayOfMonth: 15 });
  }

  // ניכויים (טופס 102) - נדרש רק ממי שמעסיק עובדים
  if (client.hasEmployees) {
    rules.push(...withholdingRules);
  }

  // דוח רווח והפסד רבעוני - נכלל בחבילת השירות המלא בלבד
  if (client.serviceType === "FULL") {
    rules.push({ taskType: "QUARTERLY_PL_REPORT", frequency: "QUARTERLY", dayOfMonth: 30 });
  }

  rules.push(annualReport);

  return rules;
}
