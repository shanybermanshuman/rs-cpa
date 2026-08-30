"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ClientContact } from "@/generated/prisma/client";
import {
  createContact,
  deleteContact,
  setPrimaryContact,
  updateContact,
  type ContactFormState,
} from "@/app/clients/contact-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "שומר..." : label}
    </Button>
  );
}

function ContactFields({
  contact,
  errors,
  idPrefix,
}: {
  contact?: ClientContact;
  errors: Record<string, string>;
  idPrefix: string;
}) {
  const field = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={field("name")}>שם *</Label>
        <Input id={field("name")} name="name" defaultValue={contact?.name ?? ""} required />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={field("role")}>תפקיד</Label>
        <Input
          id={field("role")}
          name="role"
          placeholder="למשל: מנהלת חשבונות"
          defaultValue={contact?.role ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={field("phone")}>טלפון</Label>
        <Input
          id={field("phone")}
          name="phone"
          type="tel"
          dir="ltr"
          className="text-right"
          defaultValue={contact?.phone ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={field("email")}>מייל</Label>
        <Input
          id={field("email")}
          name="email"
          type="email"
          dir="ltr"
          className="text-right"
          defaultValue={contact?.email ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={field("whatsapp")}>וואטסאפ</Label>
        <Input
          id={field("whatsapp")}
          name="whatsapp"
          dir="ltr"
          className="text-right"
          defaultValue={contact?.whatsapp ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={field("notes")}>הערה</Label>
        <Input id={field("notes")} name="notes" defaultValue={contact?.notes ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="isPrimary"
          defaultChecked={contact?.isPrimary ?? false}
          className="size-4 accent-accent"
        />
        <span>איש קשר ראשי</span>
      </label>
    </div>
  );
}

function AddContactForm({ clientId }: { clientId: string }) {
  const [state, formAction] = useActionState<ContactFormState, FormData>(
    createContact.bind(null, clientId),
    {},
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        הוספת איש קשר
      </Button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-md border p-3">
      <ContactFields errors={state.fieldErrors ?? {}} idPrefix="new" />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitButton label="הוספה" />
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

function EditContactForm({
  contact,
  onDone,
}: {
  contact: ClientContact;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ContactFormState, FormData>(
    updateContact.bind(null, contact.id),
    {},
  );

  // נסגר רק אחרי שמירה שהצליחה, ולא במצב ההתחלתי הריק
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-3 rounded-md border p-3">
      <ContactFields
        contact={contact}
        errors={state.fieldErrors ?? {}}
        idPrefix={contact.id}
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitButton label="שמירה" />
        <Button variant="ghost" size="sm" onClick={onDone}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

function ContactRow({ contact }: { contact: ClientContact }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <EditContactForm contact={contact} onDone={() => setEditing(false)} />;
  }

  return (
    <li
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 rounded-md border p-3",
        contact.isPrimary && "border-accent bg-accent/5",
      )}
    >
      <div className="min-w-48 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{contact.name}</span>
          {contact.role && (
            <span className="text-sm text-muted-foreground">· {contact.role}</span>
          )}
          {contact.isPrimary && (
            <Badge className="bg-accent text-accent-foreground">ראשי</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          {contact.phone && (
            <a href={`tel:${contact.phone}`} dir="ltr" className="hover:text-accent">
              {contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} dir="ltr" className="hover:text-accent">
              {contact.email}
            </a>
          )}
          {contact.whatsapp && <span dir="ltr">וואטסאפ: {contact.whatsapp}</span>}
        </div>
        {contact.notes && (
          <p className="text-xs text-muted-foreground">{contact.notes}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {!contact.isPrimary && (
          <form action={setPrimaryContact.bind(null, contact.id)}>
            <Button type="submit" variant="ghost" size="sm">
              סימון כראשי
            </Button>
          </form>
        )}
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          עריכה
        </Button>
        <form
          action={deleteContact.bind(null, contact.id)}
          onSubmit={(e) => {
            if (!confirm(`למחוק את ${contact.name} מאנשי הקשר?`)) e.preventDefault();
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
      </div>
    </li>
  );
}

/** ניהול אנשי הקשר של הלקוח, כולל סימון איש קשר ראשי. */
export function ClientContacts({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: ClientContact[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">אנשי קשר ({contacts.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            טרם הוזנו אנשי קשר ללקוח זה.
          </p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <ContactRow key={c.id} contact={c} />
            ))}
          </ul>
        )}
        <AddContactForm clientId={clientId} />
      </CardContent>
    </Card>
  );
}
