import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAlerts, summarizeAlerts } from "@/lib/alerts";
import { dailyDigestHtml, isEmailConfigured, sendEmail } from "@/lib/email";

/**
 * הסיכום היומי במייל לצוות המשרד. מוגדר ב-vercel.json ורץ ב-05:00 UTC
 * (07:00 בחורף, 08:00 בקיץ) - שעה אחרי generate-tasks, כדי שסימון המשימות
 * באיחור כבר יתבצע ולא יחסר מהסיכום.
 *
 * הנמענים הם משתמשי המערכת הפעילים בלבד - לא הלקוחות. זו החלטה מפורשת:
 * המייל הוא כלי ניהול פנימי, ומייל אוטומטי שיוצא ללקוח בטעות פוגע באמון.
 *
 * כשאין מה לדווח, לא נשלח מייל. מייל יומי שרובו "אין חדש" מאבד את תשומת
 * הלב בדיוק ביום שבו יש בו משהו.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const alerts = await getAlerts();
    const summary = summarizeAlerts(alerts);

    if (alerts.length === 0) {
      return NextResponse.json({ status: "ok", sent: false, reason: "אין התראות פתוחות" });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json({
        status: "ok",
        sent: false,
        reason: "שליחת מייל אינה מוגדרת (RESEND_API_KEY / ALERT_EMAIL_FROM)",
        ...summary,
      });
    }

    const recipients = await prisma.user.findMany({
      where: { isActive: true },
      select: { email: true },
    });

    const baseUrl = process.env.APP_BASE_URL ?? request.nextUrl.origin;
    const dateLabel = new Intl.DateTimeFormat("he-IL", {
      dateStyle: "full",
      timeZone: "Asia/Jerusalem",
    }).format(new Date());

    const result = await sendEmail({
      to: recipients.map((r) => r.email),
      subject:
        summary.critical > 0
          ? `${summary.critical} דברים דחופים · סיכום יומי`
          : `${summary.total} משימות לטיפול · סיכום יומי`,
      html: dailyDigestHtml({ alerts, baseUrl, dateLabel }),
    });

    return NextResponse.json({
      status: result.error ? "error" : "ok",
      recipients: recipients.length,
      ...summary,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
