"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import {
  assignAllUnassigned,
  assignExtension,
  createExtension,
  deleteExtension,
  type AnnualFormState,
} from "@/app/annual-reports/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { NativeSelect } from "@/components/ui/native-select";

type ExtensionOption = { id: string; name: string };

function Pending({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** הוספת מועד אורכה חדש לשנת מס, במסלול מסוים (חברות או יחידים). */
export function AddExtensionForm({
  taxYear,
  kind,
}: {
  taxYear: number;
  kind: string;
}) {
  const [state, formAction] = useActionState<AnnualFormState, FormData>(
    createExtension,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="taxYear" value={taxYear} />
      <input type="hidden" name="kind" value={kind} />
      <div className="space-y-2">
        <label htmlFor={`ext-name-${kind}`} className="text-sm font-medium">
          שם המועד
        </label>
        <Input
          id={`ext-name-${kind}`}
          name="name"
          placeholder="למשל: אורכה שנייה"
          className="w-44"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor={`ext-date-${kind}`} className="text-sm font-medium">
          מועד הגשה
        </label>
        <DateField
          id={`ext-date-${kind}`}
          name="dueDate"
          className="w-40"
          required
        />
      </div>
      <Pending label="הוספת מועד" pendingLabel="מוסיף..." />
      {state.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function DeleteExtensionButton({
  extensionId,
  name,
}: {
  extensionId: string;
  name: string;
}) {
  return (
    <form
      action={deleteExtension.bind(null, extensionId)}
      onSubmit={(event) => {
        if (
          !confirm(
            `למחוק את המועד "${name}"? הלקוחות המשויכים אליו לא יימחקו, אך יחזרו למצב "לא שויך".`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10"
      >
        מחיקה
      </Button>
    </form>
  );
}

/** בורר מועד האורכה של לקוח בודד, נשמר מיד עם הבחירה. */
export function ExtensionSelect({
  taskId,
  currentId,
  options,
}: {
  taskId: string;
  currentId: string | null;
  options: ExtensionOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={assignExtension.bind(null, taskId)}>
      {/* key מכריח רינדור מחדש כשהערך משתנה מבחוץ (למשל שיוך קבוצתי);
          בלעדיו defaultValue נשאר על הערך שהיה בעת הטעינה הראשונה */}
      <NativeSelect
        key={currentId ?? "none"}
        name="extensionId"
        defaultValue={currentId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-8 w-40 text-xs"
        aria-label="מועד הגשה"
      >
        <option value="">לא שויך</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </NativeSelect>
    </form>
  );
}

/** שיוך מהיר של כל מי שטרם שויך למועד אחד. */
export function AssignAllForm({
  periodLabel,
  options,
  kind,
}: {
  periodLabel: string;
  options: ExtensionOption[];
  kind: string;
}) {
  const [state, formAction] = useActionState<AnnualFormState, FormData>(
    assignAllUnassigned,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="periodLabel" value={periodLabel} />
      <div className="space-y-2">
        <label htmlFor={`assign-all-${kind}`} className="text-sm font-medium">
          שיוך כל מי שטרם שויך
        </label>
        <NativeSelect
          id={`assign-all-${kind}`}
          name="extensionId"
          className="w-44"
          required
        >
          <option value="">בחירת מועד</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Pending label="שיוך" pendingLabel="משייך..." />
      {state.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
