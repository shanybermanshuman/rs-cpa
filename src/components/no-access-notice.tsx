import { logout } from "@/app/login/actions";
import { BrandHeader } from "@/components/brand-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * מוצג כשמשתמש התחבר בהצלחה ל-Supabase Auth אך אין לו רשומת עובד/ת מתאימה
 * בטבלת `users` - כלומר אין לו הרשאה להשתמש במערכת.
 */
export function NoAccessNotice() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm space-y-8">
        <BrandHeader />
        <Card>
          <CardContent className="space-y-4 pt-6 text-center">
            <h1 className="text-lg font-semibold">אין הרשאה למערכת</h1>
            <p className="text-sm text-muted-foreground">
              החשבון שלך אינו מוגדר כעובד/ת במשרד. יש לפנות לאחת השותפות כדי
              לקבל הרשאה.
            </p>
            <form action={logout}>
              <Button type="submit" variant="outline" className="w-full">
                התנתקות
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
