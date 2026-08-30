import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// לפני שהוגדר פרויקט Supabase אמיתי (ראו .env.example) אין טעם להריץ בדיקת
// אימות - כדי שהאפליקציה תישאר נגישה לפיתוח מקומי בלבד.
const isSupabaseConfigured =
  !!supabaseUrl && !!supabaseAnonKey && !supabaseUrl.includes("[YOUR-PROJECT-REF]");

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured) {
    // בייצור חוסר הגדרה חייב לחסום ולא לפתוח: אחרת משתנה סביבה חסר היה
    // הופך את כל המערכת לנגישה ללא התחברות.
    if (process.env.NODE_ENV === "production") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");

  // מסלולים שאינם מוגנים בהתחברות משתמש:
  // - /api/health נגיש בכוונה, לניטור חיצוני של תקינות המערכת
  // - /api/cron/* מוגן בסוד משלו (CRON_SECRET) ונקרא ע"י Vercel Cron ולא ע"י משתמש
  const isPublicRoute =
    pathname === "/api/health" || pathname.startsWith("/api/cron/");

  if (isPublicRoute) {
    return supabaseResponse;
  }

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
