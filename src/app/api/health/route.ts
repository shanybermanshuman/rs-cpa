import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// נקודת בדיקה ציבורית: מאמתת שהאפליקציה מצליחה להתחבר למסד הנתונים בזמן ריצה
// (דרך ה-Transaction Pooler), בנפרד מהחיבור שבו רצות המיגרציות.
// מחזירה סטטוס בלבד וללא נתונים עסקיים, ולכן בטוחה לחשיפה.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", database: "unreachable", message: (error as Error).message },
      { status: 500 },
    );
  }
}
