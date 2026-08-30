"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createAnnualReports, type AnnualFormState } from "@/app/annual-reports/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "יוצר..." : "פתיחת שנת מס"}
    </Button>
  );
}

/** פתיחת דוחות שנתיים לשנת מס שעדיין לא נפתחה במערכת. */
export function CreateAnnualReportsForm({ defaultYear }: { defaultYear: number }) {
  const [state, formAction] = useActionState<AnnualFormState, FormData>(
    createAnnualReports,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <label htmlFor="year" className="text-sm font-medium">
          פתיחת דוחות לשנת מס
        </label>
        <Input
          id="year"
          name="year"
          type="number"
          min="2000"
          max="2100"
          defaultValue={defaultYear}
          dir="ltr"
          className="w-28 text-right"
          required
        />
      </div>
      <SubmitButton />
      {state.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
