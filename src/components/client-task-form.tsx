"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { Client, ClientTask, User } from "@/generated/prisma/client";
import type { ClientTaskFormState } from "@/app/tasks/task-actions";
import {
  clientTaskTypeLabels,
  taskPriorityLabels,
  taskStatusLabels,
  toOptions,
} from "@/lib/enums";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent } from "@/components/ui/card";

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

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function ClientTaskForm({
  action,
  task,
  clients,
  users,
  lockedClientId,
  submitLabel,
  cancelHref,
}: {
  action: (
    state: ClientTaskFormState,
    formData: FormData,
  ) => Promise<ClientTaskFormState>;
  task?: ClientTask;
  clients: Pick<Client, "id" | "businessName">[];
  users: Pick<User, "id" | "name">[];
  /** כשנכנסים מכרטיס לקוח, הלקוח קבוע ולא ניתן לשינוי */
  lockedClientId?: string;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<ClientTaskFormState, FormData>(action, {});
  const [taskType, setTaskType] = useState<string>(task?.taskType ?? "OTHER");
  const errors = state.fieldErrors ?? {};
  const clientId = task?.clientId ?? lockedClientId;
  const lockedClient = clients.find((c) => c.id === lockedClientId);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          {lockedClient ? (
            <div className="space-y-2">
              <Label>לקוח</Label>
              <p className="flex h-9 items-center text-sm font-medium">
                {lockedClient.businessName}
              </p>
              <input type="hidden" name="clientId" value={lockedClient.id} />
            </div>
          ) : (
            <Field label="לקוח *" htmlFor="clientId" error={errors.clientId}>
              <NativeSelect id="clientId" name="clientId" defaultValue={clientId ?? ""} required>
                <option value="">בחירת לקוח</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          <Field label="סוג המשימה *" htmlFor="taskType" error={errors.taskType}>
            <NativeSelect
              id="taskType"
              name="taskType"
              value={taskType}
              onChange={(e) => setTaskType(e.currentTarget.value)}
            >
              {toOptions(clientTaskTypeLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          {/* "אחר" בלי פירוט אינו אומר דבר, ולכן הפירוט נדרש כשנבחר */}
          {taskType === "OTHER" && (
            <Field
              label="פירוט המשימה *"
              htmlFor="taskTypeOther"
              error={errors.taskTypeOther}
              hint="מה צריך לעשות — זה מה שיופיע ברשימות ובהתראות"
            >
              <Input
                id="taskTypeOther"
                name="taskTypeOther"
                placeholder="למשל: הכנת אישור רו״ח לבנק"
                defaultValue={task?.taskTypeOther ?? ""}
                required
              />
            </Field>
          )}

          <Field label="מועד הגשה *" htmlFor="dueDate" error={errors.dueDate}>
            <DateField
              id="dueDate"
              name="dueDate"
              defaultValue={toDateInputValue(task?.dueDate)}
              required
            />
          </Field>

          <Field
            label="תקופת הדיווח"
            htmlFor="periodLabel"
            error={errors.periodLabel}
            hint='לדוגמה: "ינואר 2026" או "שנת 2025"'
          >
            <Input id="periodLabel" name="periodLabel" defaultValue={task?.periodLabel ?? ""} />
          </Field>

          <Field label="אחראי/ת" htmlFor="assigneeId" error={errors.assigneeId}>
            <NativeSelect id="assigneeId" name="assigneeId" defaultValue={task?.assigneeId ?? ""}>
              <option value="">לא שויך</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="סטטוס" htmlFor="status" error={errors.status}>
            <NativeSelect id="status" name="status" defaultValue={task?.status ?? "NOT_STARTED"}>
              {toOptions(taskStatusLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="עדיפות" htmlFor="priority" error={errors.priority}>
            <NativeSelect id="priority" name="priority" defaultValue={task?.priority ?? "MEDIUM"}>
              {toOptions(taskPriorityLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <div className="sm:col-span-2">
            <Field label="הערות" htmlFor="notes" error={errors.notes}>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={task?.notes ?? ""}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton label={submitLabel} />
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          ביטול
        </Link>
      </div>
    </form>
  );
}
