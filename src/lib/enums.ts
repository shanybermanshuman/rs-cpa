import type { ClientTaskType } from "@/generated/prisma/client";

/**
 * תרגום ערכי ה-enum מהסכמה לתוויות בעברית להצגה בממשק.
 *
 * ה-enums מוגדרים באנגלית ב-`prisma/schema.prisma` (מוסכמה מקובלת שמונעת
 * בעיות קידוד ומקלה על שאילתות), וכל טקסט שמוצג למשתמש עובר דרך כאן.
 * בעת הוספת ערך חדש לסכמה יש להוסיף כאן תווית מתאימה.
 */

export const clientTypeLabels = {
  COMPANY: "חברה",
  SELF_EMPLOYED: "עצמאי",
  EXEMPT_DEALER: "עוסק פטור",
  CONTROLLING_SHAREHOLDER: "בעל שליטה",
} as const;

export const serviceTypeLabels = {
  FULL: "מלא",
  BOOKKEEPING: "הנהלת חשבונות",
  SELF_EMPLOYED_PACKAGE: "עצמאי",
  ACCOUNTING_ONLY: "ראיית חשבון בלבד",
  OTHER: "אחר",
} as const;

export const vatFrequencyLabels = {
  MONTHLY: "חד-חודשי",
  BIMONTHLY: "דו-חודשי",
} as const;

export const clientStatusLabels = {
  ACTIVE: "פעיל",
  INACTIVE: "לא פעיל",
  ONBOARDING: "בקליטה",
} as const;

export const clientTaskTypeLabels = {
  VAT: 'דיווח מע"מ',
  INCOME_TAX_ADVANCE: "מקדמות מס הכנסה",
  NATIONAL_INSURANCE: "ביטוח לאומי",
  WITHHOLDING_TAX: "ניכויים (טופס 102)",
  QUARTERLY_PL_REPORT: "דוח רווח והפסד רבעוני",
  ANNUAL_REPORT: "דוח שנתי",
  CAPITAL_DECLARATION: "הצהרת הון",
  OTHER: "אחר",
} as const;

export const taskStatusLabels = {
  NOT_STARTED: "טרם החל",
  IN_PROGRESS: "בטיפול",
  WAITING_ON_CLIENT: "ממתין למסמכים",
  SUBMITTED: "הוגש",
  DONE: "הושלם",
  OVERDUE: "באיחור",
} as const;

export const taskPriorityLabels = {
  LOW: "נמוכה",
  MEDIUM: "רגילה",
  HIGH: "גבוהה",
} as const;

export const internalTaskCategoryLabels = {
  ADMIN: "אדמיניסטרציה",
  HR: "כוח אדם",
  MARKETING: "שיווק",
  IT: "מחשוב",
} as const;

export const recurrenceFrequencyLabels = {
  MONTHLY: "חודשי",
  BIMONTHLY: "דו-חודשי",
  QUARTERLY: "רבעוני",
  YEARLY: "שנתי",
} as const;

export const projectStatusLabels = {
  IN_PROGRESS: "בעבודה",
  WAITING_DOCS: "ממתין למסמכים",
  WAITING_REPLY: "ממתין לתשובות",
  DONE: "הסתיים",
} as const;

export const userRoleLabels = {
  PARTNER: "שותפה",
  EMPLOYEE: "עובד/ת",
} as const;

/** ממיר מפת תוויות למערך אפשרויות עבור רכיבי בחירה. */
export function toOptions<T extends Record<string, string>>(labels: T) {
  return Object.entries(labels).map(([value, label]) => ({
    value: value as keyof T & string,
    label,
  }));
}

/**
 * תווית סוג המשימה להצגה.
 *
 * כשהסוג הוא "אחר" מוצג הפירוט החופשי במקום המילה "אחר" - הוא מה שמזהה
 * את המשימה בפועל, והמילה "אחר" לבדה אינה אומרת דבר ברשימה.
 */
export function clientTaskTypeLabel(task: {
  taskType: ClientTaskType;
  taskTypeOther?: string | null;
}): string {
  return task.taskType === "OTHER" && task.taskTypeOther
    ? task.taskTypeOther
    : clientTaskTypeLabels[task.taskType];
}
