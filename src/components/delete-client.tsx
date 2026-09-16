"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteClient, type ClientFormState } from "@/app/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      className="border-destructive text-destructive hover:bg-destructive/10"
    >
      {pending ? "מוחק..." : "מחיקה סופית"}
    </Button>
  );
}

/**
 * מחיקת לקוח, עם אישור בהקלדת שם העסק.
 *
 * המסך מציג במפורש מה יימחק ומציע קודם את החלופה הנכונה לרוב המקרים -
 * סימון הלקוח כ"לא פעיל", ששומר את ההיסטוריה.
 */
export function DeleteClient({
  clientId,
  businessName,
  counts,
}: {
  clientId: string;
  businessName: string;
  counts: { tasks: number; contacts: number; rules: number };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ClientFormState, FormData>(
    deleteClient.bind(null, clientId),
    {},
  );

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base text-destructive">מחיקת לקוח</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          המחיקה תסיר גם{" "}
          <strong className="text-foreground">{counts.tasks} משימות ודיווחים</strong>,{" "}
          <strong className="text-foreground">{counts.contacts} אנשי קשר</strong> ו-
          <strong className="text-foreground">{counts.rules} כללי דיווח</strong>.
          הפעולה אינה הפיכה ואין לה גיבוי.
        </p>
        <p className="text-sm text-muted-foreground">
          אם הלקוח פשוט סיים את ההתקשרות — עדיף לשנות את הסטטוס שלו ל&quot;לא
          פעיל&quot;. כך הוא נעלם מהמסכים השוטפים אך ההיסטוריה נשמרת.
        </p>

        {!open ? (
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setOpen(true)}
          >
            אני רוצה למחוק את הלקוח
          </Button>
        ) : (
          <form action={formAction} className="space-y-3 border-t pt-3">
            <div className="space-y-2">
              <Label htmlFor="confirmName">
                לאישור, הקלידי את שם העסק: <strong>{businessName}</strong>
              </Label>
              <Input
                id="confirmName"
                name="confirmName"
                autoComplete="off"
                placeholder={businessName}
                required
              />
              {state.fieldErrors?.confirmName && (
                <p className="text-sm text-destructive">
                  {state.fieldErrors.confirmName}
                </p>
              )}
            </div>
            {state.error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {state.error}
              </p>
            )}
            <div className="flex gap-2">
              <ConfirmButton />
              <Button variant="ghost" onClick={() => setOpen(false)}>
                ביטול
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
