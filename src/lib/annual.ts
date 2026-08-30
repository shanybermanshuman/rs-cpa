/**
 * עזרי שנת מס לדוח השנתי.
 *
 * מוחזקים כאן ולא בקובץ הפעולות, משום ש-Next.js מחייב שכל ייצוא מקובץ
 * `"use server"` יהיה פונקציה אסינכרונית.
 */

import type { AnnualReportKind, ClientType } from "@/generated/prisma/client";

export function periodLabelForYear(taxYear: number): string {
  return `שנת ${taxYear}`;
}

/**
 * סוג הדוח השנתי נגזר מסוג הלקוח:
 * חברה מגישה דוח כספי מבוקר, ואילו עצמאי ובעל שליטה מגישים דוח אישי.
 * לשני המסלולים אורכות נפרדות מול רשות המסים.
 */
export function annualReportKind(clientType: ClientType): AnnualReportKind {
  return clientType === "COMPANY" ? "COMPANY_AUDITED" : "INDIVIDUAL";
}

export const annualReportKindLabels = {
  COMPANY_AUDITED: "דוחות מבוקרים (חברות)",
  INDIVIDUAL: "דוחות אישיים (יחידים)",
} as const;

export const annualReportKindShort = {
  COMPANY_AUDITED: "מבוקר",
  INDIVIDUAL: "אישי",
} as const;

export const ANNUAL_KINDS: AnnualReportKind[] = ["COMPANY_AUDITED", "INDIVIDUAL"];

export function yearFromPeriodLabel(periodLabel: string): number | null {
  const match = periodLabel.match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}
