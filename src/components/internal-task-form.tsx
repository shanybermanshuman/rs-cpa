"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import type { InternalTask, User } from "@/generated/prisma/client";
import type { InternalTaskFormState } from "@/app/internal-tasks/actions";
import { internalTaskCategoryLabels, taskStatusLabels, toOptions } from "@/lib/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "שומר..." : label}
    </Button>
  );
}

function toDateInputValue(date: Date | null | undefined) {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

export function InternalTaskForm({
  action,
  task,
  users,
  submitLabel,
  resetOnSuccess = false,
}: {
  action: (
    state: InternalTaskFormState,
    formData: FormData,
  ) => Promise<InternalTaskFormState>;
  task?: InternalTask;
  users: Pick<User, "id" | "name">[];
  submitLabel: string;
  /** בטופס ההוספה המהירה מנקים את השדות אחרי שמירה מוצלחת */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState<InternalTaskFormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="title">כותרת המשימה *</Label>
          <Input id="title" name="title" defaultValue={task?.title ?? ""} required />
          {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">קטגוריה</Label>
          <NativeSelect id="category" name="category" defaultValue={task?.category ?? "ADMIN"}>
            {toOptions(internalTaskCategoryLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assigneeId">אחראי/ת</Label>
          <NativeSelect id="assigneeId" name="assigneeId" defaultValue={task?.assigneeId ?? ""}>
            <option value="">לא שויך</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">תאריך יעד</Label>
          <DateField
            id="dueDate"
            name="dueDate"
            defaultValue={toDateInputValue(task?.dueDate)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">סטטוס</Label>
          <NativeSelect id="status" name="status" defaultValue={task?.status ?? "NOT_STARTED"}>
            {toOptions(taskStatusLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">הערות</Label>
          <Input id="notes" name="notes" defaultValue={task?.notes ?? ""} />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
