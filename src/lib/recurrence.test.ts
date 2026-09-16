import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  dueDateForPeriod,
  dueDatesInRange,
  periodLabelFor,
  defaultRulesForClient,
} from "./recurrence";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("periodLabelFor - התקופה שהמשימה מדווחת עליה", () => {
  test("דיווח חודשי מכסה את החודש שקדם להגשה", () => {
    assert.equal(periodLabelFor("MONTHLY", 2026, 2), "ינואר 2026");
  });

  test("דיווח חודשי בינואר מכסה את דצמבר של השנה הקודמת", () => {
    assert.equal(periodLabelFor("MONTHLY", 2026, 1), "דצמבר 2025");
  });

  test("דיווח דו-חודשי מכסה את שני החודשים שקדמו", () => {
    assert.equal(periodLabelFor("BIMONTHLY", 2026, 3), "ינואר–פברואר 2026");
  });

  test("דיווח דו-חודשי בינואר מכסה נובמבר-דצמבר הקודמים", () => {
    assert.equal(periodLabelFor("BIMONTHLY", 2026, 1), "נובמבר–דצמבר 2025");
  });

  test("דיווח רבעוני מכסה את הרבעון שהסתיים", () => {
    assert.equal(periodLabelFor("QUARTERLY", 2026, 4), "רבעון 1 2026");
    assert.equal(periodLabelFor("QUARTERLY", 2026, 1), "רבעון 4 2025");
  });

  test("הדוח השנתי מכסה את שנת המס הקודמת", () => {
    assert.equal(periodLabelFor("YEARLY", 2026, 4), "שנת 2025");
  });
});

describe("dueDatesInRange - מועדי הגשה", () => {
  test('מע"מ חד-חודשי נוצר בכל חודש ב-15 בו', () => {
    const result = dueDatesInRange("MONTHLY", 15, new Date(Date.UTC(2026, 0, 1)), 3);
    assert.deepEqual(result.map((r) => iso(r.dueDate)), [
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
    assert.equal(result[0].periodLabel, "דצמבר 2025");
    assert.equal(result[1].periodLabel, "ינואר 2026");
  });

  test('מע"מ דו-חודשי נוצר רק בחודשים האי-זוגיים', () => {
    const result = dueDatesInRange("BIMONTHLY", 15, new Date(Date.UTC(2026, 0, 1)), 11);
    assert.deepEqual(result.map((r) => iso(r.dueDate)), [
      "2026-01-15",
      "2026-03-15",
      "2026-05-15",
      "2026-07-15",
      "2026-09-15",
      "2026-11-15",
    ]);
    assert.equal(result[1].periodLabel, "ינואר–פברואר 2026");
  });

  test("דוח רבעוני נוצר ארבע פעמים בשנה", () => {
    const result = dueDatesInRange("QUARTERLY", 30, new Date(Date.UTC(2026, 0, 1)), 11);
    assert.deepEqual(result.map((r) => iso(r.dueDate)), [
      "2026-01-30",
      "2026-04-30",
      "2026-07-30",
      "2026-10-30",
    ]);
  });

  test("דוח שנתי נוצר פעם אחת, באפריל", () => {
    const result = dueDatesInRange("YEARLY", 30, new Date(Date.UTC(2026, 0, 1)), 11);
    assert.deepEqual(result.map((r) => iso(r.dueDate)), ["2026-04-30"]);
    assert.equal(result[0].periodLabel, "שנת 2025");
  });

  test("מועד שכבר חלף אינו נוצר", () => {
    // מתחילים ב-20 בינואר, ולכן ה-15 בינואר כבר מאחורינו
    const result = dueDatesInRange("MONTHLY", 15, new Date(Date.UTC(2026, 0, 20)), 2);
    assert.deepEqual(result.map((r) => iso(r.dueDate)), [
      "2026-02-15",
      "2026-03-15",
    ]);
  });

  test("מועד ביום שאינו קיים בחודש מקוצר לסוף החודש", () => {
    const result = dueDatesInRange("MONTHLY", 31, new Date(Date.UTC(2026, 1, 1)), 0);
    assert.deepEqual(result.map((r) => iso(r.dueDate)), ["2026-02-28"]);
  });

  test("שנה מעוברת מטופלת נכון", () => {
    const result = dueDatesInRange("MONTHLY", 31, new Date(Date.UTC(2028, 1, 1)), 0);
    assert.deepEqual(result.map((r) => iso(r.dueDate)), ["2028-02-29"]);
  });
});

describe("defaultRulesForClient - כללי ברירת המחדל ללקוח חדש", () => {
  test("עצמאי דו-חודשי מקבל מע\"מ, מקדמות, ביטוח לאומי ודוח שנתי", () => {
    const rules = defaultRulesForClient({
      clientType: "SELF_EMPLOYED",
      serviceType: "SELF_EMPLOYED_PACKAGE",
      vatFrequency: "BIMONTHLY",
      hasEmployees: false,
    });
    assert.deepEqual(rules.map((r) => r.taskType), [
      "VAT",
      "INCOME_TAX_ADVANCE",
      "NATIONAL_INSURANCE",
      "ANNUAL_REPORT",
    ]);
    assert.equal(rules[0].frequency, "BIMONTHLY");
  });

  test("חברה אינה מקבלת משימת ביטוח לאומי", () => {
    const rules = defaultRulesForClient({
      clientType: "COMPANY",
      serviceType: "BOOKKEEPING",
      vatFrequency: "MONTHLY",
      hasEmployees: false,
    });
    assert.ok(!rules.some((r) => r.taskType === "NATIONAL_INSURANCE"));
    assert.ok(rules.some((r) => r.taskType === "VAT"));
  });

  test("בעל שליטה מקבל דוח שנתי בלבד, ללא דיווחים שוטפים", () => {
    const rules = defaultRulesForClient({
      clientType: "CONTROLLING_SHAREHOLDER",
      serviceType: "OTHER",
      vatFrequency: null,
      hasEmployees: false,
    });
    assert.deepEqual(rules.map((r) => r.taskType), ["ANNUAL_REPORT"]);
  });

  test("עוסק פטור מקבל דוח שנתי בלבד, ללא דיווחים חודשיים", () => {
    const rules = defaultRulesForClient({
      clientType: "EXEMPT_DEALER",
      serviceType: "SELF_EMPLOYED_PACKAGE",
      vatFrequency: null,
      hasEmployees: false,
    });
    assert.deepEqual(rules.map((r) => r.taskType), ["ANNUAL_REPORT"]);
  });

  test("עוסק פטור אינו מקבל מע\"מ גם אם הוגדרה לו תדירות בטעות", () => {
    const rules = defaultRulesForClient({
      clientType: "EXEMPT_DEALER",
      serviceType: "SELF_EMPLOYED_PACKAGE",
      vatFrequency: "MONTHLY",
      hasEmployees: false,
    });
    assert.deepEqual(rules.map((r) => r.taskType), ["ANNUAL_REPORT"]);
  });

  test("עוסק פטור אינו מקבל מקדמות או ביטוח לאומי", () => {
    const rules = defaultRulesForClient({
      clientType: "EXEMPT_DEALER",
      serviceType: "FULL",
      vatFrequency: null,
      hasEmployees: false,
    });
    assert.ok(!rules.some((r) => r.taskType === "INCOME_TAX_ADVANCE"));
    assert.ok(!rules.some((r) => r.taskType === "NATIONAL_INSURANCE"));
    assert.ok(!rules.some((r) => r.taskType === "QUARTERLY_PL_REPORT"));
  });

  test("עוסק פטור שמעסיק עובדים כן מקבל ניכויים - החובה נובעת מהעסקה ולא ממע\"מ", () => {
    const rules = defaultRulesForClient({
      clientType: "EXEMPT_DEALER",
      serviceType: "SELF_EMPLOYED_PACKAGE",
      vatFrequency: null,
      hasEmployees: true,
    });
    assert.deepEqual(rules.map((r) => r.taskType), [
      "WITHHOLDING_TAX",
      "WITHHOLDING_NI",
      "ANNUAL_REPORT",
    ]);
  });

  test("בעל שליטה אינו מקבל מע\"מ גם אם הוגדרה לו תדירות בטעות", () => {
    const rules = defaultRulesForClient({
      clientType: "CONTROLLING_SHAREHOLDER",
      serviceType: "FULL",
      vatFrequency: "MONTHLY",
      hasEmployees: false,
    });
    assert.deepEqual(rules.map((r) => r.taskType), ["ANNUAL_REPORT"]);
  });

  test("לקוח ללא תדירות מע\"מ אינו מקבל משימת מע\"מ", () => {
    const rules = defaultRulesForClient({
      clientType: "SELF_EMPLOYED",
      serviceType: "OTHER",
      vatFrequency: null,
      hasEmployees: false,
    });
    assert.ok(!rules.some((r) => r.taskType === "VAT"));
  });

  test("מעסיק עובדים מקבל דיווח ניכויים (טופס 102)", () => {
    const rules = defaultRulesForClient({
      clientType: "COMPANY",
      serviceType: "FULL",
      vatFrequency: "MONTHLY",
      hasEmployees: true,
    });
    assert.ok(rules.some((r) => r.taskType === "WITHHOLDING_TAX"));
  });

  test("מעסיק עובדים מקבל ניכויים נפרדים למס הכנסה ולביטוח לאומי", () => {
    const rules = defaultRulesForClient({
      clientType: "COMPANY",
      serviceType: "BOOKKEEPING",
      vatFrequency: "MONTHLY",
      hasEmployees: true,
    });
    const types = rules.map((r) => r.taskType);
    assert.ok(types.includes("WITHHOLDING_TAX"));
    assert.ok(types.includes("WITHHOLDING_NI"));
    // שניהם חודשיים ב-15, כמו טופס 102
    for (const t of ["WITHHOLDING_TAX", "WITHHOLDING_NI"] as const) {
      const rule = rules.find((r) => r.taskType === t)!;
      assert.equal(rule.frequency, "MONTHLY");
      assert.equal(rule.dayOfMonth, 15);
    }
  });

  test("מי שאינו מעסיק עובדים אינו מקבל דיווח ניכויים", () => {
    const rules = defaultRulesForClient({
      clientType: "COMPANY",
      serviceType: "FULL",
      vatFrequency: "MONTHLY",
      hasEmployees: false,
    });
    assert.ok(!rules.some((r) => r.taskType === "WITHHOLDING_TAX"));
    assert.ok(!rules.some((r) => r.taskType === "WITHHOLDING_NI"));
  });

  test("בעל שליטה אינו מקבל ניכויים גם אם סומן כמעסיק", () => {
    const rules = defaultRulesForClient({
      clientType: "CONTROLLING_SHAREHOLDER",
      serviceType: "OTHER",
      vatFrequency: null,
      hasEmployees: true,
    });
    assert.deepEqual(rules.map((r) => r.taskType), ["ANNUAL_REPORT"]);
  });

  test("שירות מלא כולל גם דוח רווח והפסד רבעוני", () => {
    const rules = defaultRulesForClient({
      clientType: "SELF_EMPLOYED",
      serviceType: "FULL",
      vatFrequency: "MONTHLY",
      hasEmployees: false,
    });
    assert.ok(rules.some((r) => r.taskType === "QUARTERLY_PL_REPORT"));
  });
});

describe("dueDateForPeriod - מועד ההגשה של תקופה, לקליטה למפרע", () => {
  test("תקופה חודשית מוגשת ב-15 בחודש שאחריה", () => {
    const result = dueDateForPeriod("MONTHLY", 15, 2026, 3);
    assert.equal(iso(result!.dueDate), "2026-04-15");
    assert.equal(result!.periodLabel, "מרץ 2026");
  });

  test("תקופת דצמבר מוגשת בינואר של השנה הבאה", () => {
    const result = dueDateForPeriod("MONTHLY", 15, 2026, 12);
    assert.equal(iso(result!.dueDate), "2027-01-15");
    assert.equal(result!.periodLabel, "דצמבר 2026");
  });

  test("תקופה דו-חודשית תקפה רק בחודשי סיום התקופה", () => {
    const valid = dueDateForPeriod("BIMONTHLY", 15, 2026, 2);
    assert.equal(iso(valid!.dueDate), "2026-03-15");
    assert.equal(valid!.periodLabel, "ינואר–פברואר 2026");
    // מרץ אינו חודש סיום של תקופה דו-חודשית
    assert.equal(dueDateForPeriod("BIMONTHLY", 15, 2026, 3), null);
  });

  test("תקופה רבעונית תקפה רק בחודש סיום הרבעון", () => {
    const valid = dueDateForPeriod("QUARTERLY", 30, 2026, 3);
    assert.equal(iso(valid!.dueDate), "2026-04-30");
    assert.equal(valid!.periodLabel, "רבעון 1 2026");
    assert.equal(dueDateForPeriod("QUARTERLY", 30, 2026, 4), null);
  });

  test("יום שאינו קיים בחודש ההגשה מקוצר לסוף החודש", () => {
    const result = dueDateForPeriod("MONTHLY", 31, 2026, 1);
    assert.equal(iso(result!.dueDate), "2026-02-28");
  });

  test("חודש לא חוקי מוחזר כ-null", () => {
    assert.equal(dueDateForPeriod("MONTHLY", 15, 2026, 0), null);
    assert.equal(dueDateForPeriod("MONTHLY", 15, 2026, 13), null);
  });

  test("הפוך ל-periodLabelFor: מה שנכנס הוא מה שיוצא", () => {
    for (const month of [1, 2, 6, 11, 12]) {
      const result = dueDateForPeriod("MONTHLY", 15, 2026, month);
      const back = periodLabelFor(
        "MONTHLY",
        result!.dueDate.getUTCFullYear(),
        result!.dueDate.getUTCMonth() + 1,
      );
      assert.equal(back, result!.periodLabel);
    }
  });
});
