import type { Metadata } from "next";
import { BrandHeader } from "@/components/brand-header";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "התחברות | סרנגה ושומן",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm space-y-8">
        <BrandHeader />

        <Card>
          <CardContent className="pt-6">
            <div className="mb-6 space-y-1 text-center">
              <h1 className="text-xl font-semibold">כניסה למערכת</h1>
              <p className="text-sm text-muted-foreground">
                ניהול לקוחות ומשימות המשרד
              </p>
            </div>

            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          אין לך גישה? יש לפנות לאחת השותפות לפתיחת משתמש.
        </p>
      </div>
    </div>
  );
}
