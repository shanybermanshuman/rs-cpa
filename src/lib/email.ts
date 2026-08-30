import type { Alert } from "@/lib/alerts";

/**
 * שליחת מייל דרך Resend.
 *
 * הקריאה נעשית ב-fetch ישירות ל-REST API ולא דרך חבילה נוספת - זו קריאת
 * HTTP אחת, ותלות נוספת כאן רק מוסיפה משקל ותחזוקה.
 *
 * כל עוד המפתחות אינם מוגדרים הפונקציה **אינה נכשלת** אלא מדווחת שהמייל
 * אינו מוגדר, כדי שהמערכת תמשיך לעבוד בלי חשבון Resend.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_FROM);
}

export type SendResult = { sent: boolean; skipped?: string; error?: string };

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string[];
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (!isEmailConfigured()) {
    return { sent: false, skipped: "RESEND_API_KEY או ALERT_EMAIL_FROM אינם מוגדרים" };
  }
  if (to.length === 0) {
    return { sent: false, skipped: "אין נמענים פעילים" };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.ALERT_EMAIL_FROM,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    return { sent: false, error: `${response.status} ${await response.text()}` };
  }

  return { sent: true };
}

const BLACK = "#111111";
const GOLD = "#C9A456";
const RED = "#B3261E";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function alertRow(alert: Alert, baseUrl: string) {
  const color = alert.severity === "CRITICAL" ? RED : "#555555";
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eeeeee;">
        <a href="${baseUrl}${alert.href}" style="color:${BLACK};text-decoration:none;font-weight:600;">
          ${escapeHtml(alert.title)}
        </a>
        <div style="color:${color};font-size:13px;margin-top:2px;">
          ${escapeHtml(alert.detail)}
        </div>
      </td>
    </tr>`;
}

/**
 * תבנית הסיכום היומי, בעברית ובכיוון RTL, בצבעי המשרד.
 * הכל inline כי לקוחות מייל מתעלמים מ-CSS חיצוני.
 */
export function dailyDigestHtml({
  alerts,
  baseUrl,
  dateLabel,
}: {
  alerts: Alert[];
  baseUrl: string;
  dateLabel: string;
}) {
  const critical = alerts.filter((a) => a.severity === "CRITICAL");
  const warning = alerts.filter((a) => a.severity !== "CRITICAL");

  const section = (title: string, items: Alert[], color: string) =>
    items.length === 0
      ? ""
      : `
        <h2 style="font-size:15px;color:${color};margin:24px 0 4px;">
          ${title} (${items.length})
        </h2>
        <table role="presentation" width="100%" style="border-collapse:collapse;">
          ${items.map((a) => alertRow(a, baseUrl)).join("")}
        </table>`;

  return `<!doctype html>
<html lang="he" dir="rtl">
  <body style="margin:0;padding:24px;background:#f7f7f5;font-family:Arial,Helvetica,sans-serif;color:${BLACK};">
    <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-top:3px solid ${GOLD};border-radius:6px;">
      <tr>
        <td style="padding:24px;">
          <div style="font-size:18px;font-weight:700;">סרנגה ושומן · רואות חשבון</div>
          <div style="font-size:13px;color:#666666;margin-top:2px;">
            סיכום יומי · ${escapeHtml(dateLabel)}
          </div>

          <p style="font-size:14px;margin:20px 0 0;">
            ${
              alerts.length === 0
                ? "אין כרגע דבר שדורש טיפול. הכל מסודר."
                : `${alerts.length} דברים דורשים טיפול, מתוכם <strong style="color:${RED};">${critical.length} דחופים</strong>.`
            }
          </p>

          ${section("דחוף", critical, RED)}
          ${section("לתשומת לב", warning, "#666666")}

          <p style="margin:28px 0 0;">
            <a href="${baseUrl}" style="background:${BLACK};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:4px;font-size:14px;display:inline-block;">
              פתיחת המערכת
            </a>
          </p>

          <p style="font-size:12px;color:#999999;margin:24px 0 0;">
            מייל אוטומטי מהמערכת הפנימית של המשרד. ההתראות נסגרות מאליהן כשהמשימה מטופלת.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
