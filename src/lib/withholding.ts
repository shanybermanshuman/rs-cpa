import type { Client } from "@/generated/prisma/client";
import { daysUntil } from "@/lib/dates";

/** כמה ימים לפני פקיעת אישור ניכוי במקור מתחילים להתריע. */
export const WITHHOLDING_WARNING_DAYS = 45;

export type WithholdingState =
  | "MISSING" // טרם הוזן
  | "EXEMPT" // פטור מניכוי במקור
  | "HAS_RATE" // יש שיעור ניכוי - דורש תשומת לב
  | "EXPIRING" // האישור עומד לפוג
  | "EXPIRED"; // האישור פג

export type WithholdingInfo = {
  state: WithholdingState;
  label: string;
  /** האם להציג בהדגשה אדומה */
  critical: boolean;
  ratePercent: number | null;
  daysLeft: number | null;
};

type WithholdingFields = Pick<
  Client,
  "withholdingRate" | "withholdingValidUntil"
>;

/**
 * מסכם את מצב הניכוי במקור של הלקוח.
 *
 * שני דברים דורשים תשומת לב: אישור שפג או עומד לפוג (ואז מנכים 30% מכל
 * תשלום), ושיעור ניכוי שאינו אפס (שדורש מעקב שוטף).
 */
export function withholdingInfo(client: WithholdingFields): WithholdingInfo {
  // השדה מגיע כ-Decimal של Prisma ולא כמספר, ולכן ההמרה עוברת דרך מחרוזת
  const raw = client.withholdingRate;
  const parsed = raw === null || raw === undefined ? null : Number(String(raw));
  const rate = parsed === null || Number.isNaN(parsed) ? null : parsed;
  const validUntil = client.withholdingValidUntil ?? null;
  const daysLeft = validUntil ? daysUntil(validUntil) : null;

  if (rate === null && !validUntil) {
    return {
      state: "MISSING",
      label: "לא הוזן",
      critical: false,
      ratePercent: null,
      daysLeft: null,
    };
  }

  if (daysLeft !== null && daysLeft < 0) {
    return {
      state: "EXPIRED",
      label: "האישור פג",
      critical: true,
      ratePercent: rate,
      daysLeft,
    };
  }

  if (daysLeft !== null && daysLeft <= WITHHOLDING_WARNING_DAYS) {
    return {
      state: "EXPIRING",
      label: `פג בעוד ${daysLeft} ימים`,
      critical: true,
      ratePercent: rate,
      daysLeft,
    };
  }

  if (rate === 0) {
    return {
      state: "EXEMPT",
      label: "פטור מניכוי במקור",
      critical: false,
      ratePercent: 0,
      daysLeft,
    };
  }

  // אין שיעור אך יש תוקף - חסר מידע, ולא בהכרח בעיה
  if (rate === null) {
    return {
      state: "MISSING",
      label: "לא הוזן שיעור",
      critical: false,
      ratePercent: null,
      daysLeft,
    };
  }

  return {
    state: "HAS_RATE",
    label: `ניכוי ${rate}%`,
    critical: true,
    ratePercent: rate,
    daysLeft,
  };
}
