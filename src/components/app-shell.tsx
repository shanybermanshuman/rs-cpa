import Link from "next/link";
import Image from "next/image";
import type { User } from "@/generated/prisma/client";
import { logout } from "@/app/login/actions";
import { getAlerts } from "@/lib/alerts";
import { AlertsBell } from "@/components/alerts-bell";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "לוח בקרה" },
  { href: "/clients", label: "לקוחות" },
  { href: "/filings", label: "מעקב דיווחים" },
  { href: "/tasks", label: "משימות לקוחות" },
  { href: "/annual-reports", label: "דוחות שנתיים" },
  { href: "/projects", label: "פרויקטים" },
  { href: "/internal-tasks", label: "משימות פנימיות" },
  { href: "/settings", label: "הגדרות" },
];

export async function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const alerts = await getAlerts();

  return (
    <div className="flex flex-1 flex-col">
      {/* כותרת לבנה עם קו זהב, בהתאם לניירת הרשמית של המשרד */}
      <header className="flex items-center justify-between border-b-2 border-accent bg-card px-4 py-2 md:px-6">
        <Link href="/" aria-label="לוח בקרה">
          <Image
            src="/logo.png"
            alt="סרנגה ושומן - רואות חשבון"
            width={767}
            height={222}
            priority
            className="h-8 w-auto md:h-10"
          />
        </Link>

        <div className="flex items-center gap-2 md:gap-4">
          <AlertsBell alerts={alerts} />
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              התנתקות
            </Button>
          </form>
        </div>
      </header>

      {/* במסכים צרים הניווט הופך לשורה אופקית נגללת מעל התוכן, במקום סרגל צד */}
      <div className="flex flex-1 flex-col md:flex-row">
        <nav className="shrink-0 border-b bg-card p-2 md:w-52 md:border-b-0 md:border-l md:p-4">
          <ul className="flex gap-1 overflow-x-auto md:block md:space-y-1 md:overflow-visible">
            {navItems.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-muted"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 bg-muted p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
