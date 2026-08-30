"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { Client, User } from "@/generated/prisma/client";
import type { ClientFormState } from "@/app/clients/actions";
import {
  clientStatusLabels,
  clientTypeLabels,
  serviceTypeLabels,
  toOptions,
  vatFrequencyLabels,
} from "@/lib/enums";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  client?: Client;
  users: Pick<User, "id" | "name">[];
  submitLabel: string;
};

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

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "שומר..." : label}
    </Button>
  );
}

/** תאריך בפורמט שדה input[type=date] */
function toDateInputValue(date: Date | null | undefined) {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

export function ClientForm({ action, client, users, submitLabel }: Props) {
  const [state, formAction] = useActionState<ClientFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">פרטי העסק</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="שם העסק *" htmlFor="businessName" error={errors.businessName}>
            <Input
              id="businessName"
              name="businessName"
              defaultValue={client?.businessName ?? ""}
              required
            />
          </Field>

          <Field label="ח.פ. / ת.ז" htmlFor="taxId" error={errors.taxId}>
            <Input id="taxId" name="taxId" dir="ltr" className="text-right" defaultValue={client?.taxId ?? ""} />
          </Field>

          <Field label="סוג לקוח *" htmlFor="clientType" error={errors.clientType}>
            <NativeSelect id="clientType" name="clientType" defaultValue={client?.clientType ?? "SELF_EMPLOYED"}>
              {toOptions(clientTypeLabels).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="סטטוס *" htmlFor="status" error={errors.status}>
            <NativeSelect id="status" name="status" defaultValue={client?.status ?? "ONBOARDING"}>
              {toOptions(clientStatusLabels).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ניכוי במקור</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="מספר תיק ניכויים"
            htmlFor="withholdingFileNumber"
            error={errors.withholdingFileNumber}
          >
            <Input
              id="withholdingFileNumber"
              name="withholdingFileNumber"
              dir="ltr"
              className="text-right"
              defaultValue={client?.withholdingFileNumber ?? ""}
            />
          </Field>

          <Field
            label="שיעור ניכוי במקור (%)"
            htmlFor="withholdingRate"
            error={errors.withholdingRate}
            hint="0 = פטור מניכוי במקור"
          >
            <Input
              id="withholdingRate"
              name="withholdingRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              dir="ltr"
              className="text-right"
              defaultValue={
                client?.withholdingRate !== null && client?.withholdingRate !== undefined
                  ? String(client.withholdingRate)
                  : ""
              }
            />
          </Field>

          <Field
            label="תוקף האישור"
            htmlFor="withholdingValidUntil"
            error={errors.withholdingValidUntil}
            hint="המערכת תתריע 45 יום לפני הפקיעה"
          >
            <Input
              id="withholdingValidUntil"
              name="withholdingValidUntil"
              type="date"
              defaultValue={toDateInputValue(client?.withholdingValidUntil)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">שירות והתקשרות</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="סוג שירות *" htmlFor="serviceType" error={errors.serviceType}>
            <NativeSelect id="serviceType" name="serviceType" defaultValue={client?.serviceType ?? "SELF_EMPLOYED_PACKAGE"}>
              {toOptions(serviceTypeLabels).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            label="פירוט השירות"
            htmlFor="serviceTypeOther"
            error={errors.serviceTypeOther}
            hint='למילוי כשסוג השירות הוא "אחר"'
          >
            <Input
              id="serviceTypeOther"
              name="serviceTypeOther"
              placeholder="מה כולל השירות"
              defaultValue={client?.serviceTypeOther ?? ""}
            />
          </Field>

          <Field label='תדירות דיווח מע"מ' htmlFor="vatFrequency" error={errors.vatFrequency}>
            <NativeSelect id="vatFrequency" name="vatFrequency" defaultValue={client?.vatFrequency ?? ""}>
              <option value="">ללא</option>
              {toOptions(vatFrequencyLabels).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </Field>

          {/* עובר דרך Field כמו יתר השדות, כדי ששגיאה עליו לא תיבלע */}
          <Field label="מעסיק עובדים" htmlFor="hasEmployees" error={errors.hasEmployees}>
            <div className="flex h-9 items-center gap-2">
              <input
                id="hasEmployees"
                name="hasEmployees"
                type="checkbox"
                value="on"
                defaultChecked={client?.hasEmployees ?? false}
                className="size-4 accent-accent"
              />
              <span className="text-sm text-muted-foreground">
                נדרש דיווח ניכויים (טופס 102)
              </span>
            </div>
          </Field>

          <Field label="רו״ח מטפל/ת" htmlFor="ownerId" error={errors.ownerId}>
            <NativeSelect id="ownerId" name="ownerId" defaultValue={client?.ownerId ?? ""}>
              <option value="">לא שויך</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="תאריך תחילת התקשרות" htmlFor="engagementDate" error={errors.engagementDate}>
            <Input
              id="engagementDate"
              name="engagementDate"
              type="date"
              defaultValue={toDateInputValue(client?.engagementDate)}
            />
          </Field>

          <Field label="שכר טרחה חודשי (₪)" htmlFor="monthlyFee" error={errors.monthlyFee}>
            <Input
              id="monthlyFee"
              name="monthlyFee"
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              className="text-right"
              defaultValue={client?.monthlyFee ? String(client.monthlyFee) : ""}
            />
          </Field>

          <Field label="קישור לתיקיית מסמכים" htmlFor="documentsFolderUrl" error={errors.documentsFolderUrl}>
            <Input
              id="documentsFolderUrl"
              name="documentsFolderUrl"
              dir="ltr"
              className="text-right"
              defaultValue={client?.documentsFolderUrl ?? ""}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="הערות" htmlFor="notes" error={errors.notes}>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={client?.notes ?? ""}
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
        <Link
          href={client ? `/clients/${client.id}` : "/clients"}
          className={buttonVariants({ variant: "outline" })}
        >
          ביטול
        </Link>
      </div>
    </form>
  );
}
