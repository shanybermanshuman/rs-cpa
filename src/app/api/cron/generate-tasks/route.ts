import { NextResponse, type NextRequest } from "next/server";
import { generateRecurringTasks, markOverdueTasks } from "@/lib/task-generator";

/**
 * ריצה יומית: יוצרת את המשימות הסטטוטוריות החוזרות שטרם נוצרו, ומסמנת
 * כ"באיחור" משימות שמועדן חלף. מוגדרת ב-vercel.json.
 *
 * מאובטחת ב-CRON_SECRET: Vercel Cron שולח אותו בכותרת Authorization.
 * ניתן גם להריץ ידנית לבדיקה עם אותה כותרת.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const generated = await generateRecurringTasks();
    const overdueCount = await markOverdueTasks();

    return NextResponse.json({
      status: "ok",
      rulesProcessed: generated.rulesProcessed,
      tasksCreated: generated.createdCount,
      tasksMarkedOverdue: overdueCount,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
