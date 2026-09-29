"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type {
  Project,
  ProjectKind,
  ProjectStatus,
  ProjectTask,
} from "@/generated/prisma/client";
import {
  createProject,
  createProjectTask,
  deleteProject,
  deleteProjectTask,
  updateProject,
  updateProjectStatus,
  updateProjectTaskStatus,
  toggleProjectPaid,
  type ProjectFormState,
} from "@/app/projects/actions";
import {
  projectKindLabels,
  projectPartnerLabels,
  projectStatusLabels,
  toOptions,
} from "@/lib/enums";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * אפשרויות השלב. "התקבל וטרם הותחל" מתאר עבודה שנכנסה למשרד ולא צעד בתוך
 * משימה, ולכן הוא מוסתר בבוררי השלב של המשימות.
 */
function statusOptions(scope: "project" | "task", current?: ProjectStatus) {
  const options = toOptions(projectStatusLabels);
  if (scope !== "task") return options;
  // הערך השמור נשאר ברשימה גם אם הוא מוסתר, אחרת ה-select היה מציג שלב
  // אחר מזה שבמסד - ולחיצה כלשהי הייתה משנה אותו בלי כוונה.
  return options.filter((o) => o.value !== "RECEIVED" || current === "RECEIVED");
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "שומר..." : label}
    </Button>
  );
}

/**
 * עדכון שלב הפרויקט עם הערה. ההערה נשמרת ביומן ומסבירה *למה* השלב השתנה -
 * זה מה שהופך את ההיסטוריה לשימושית ולא רק לרשימת תאריכים.
 */
export function UpdateProjectStatusForm({
  projectId,
  status,
}: {
  projectId: string;
  status: ProjectStatus;
}) {
  return (
    <form
      action={updateProjectStatus.bind(null, projectId)}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="space-y-2">
        <Label htmlFor="new-status">עדכון שלב</Label>
        <NativeSelect
          id="new-status"
          name="status"
          key={status}
          defaultValue={status}
          className="w-44"
        >
          {toOptions(projectStatusLabels).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="min-w-52 flex-1 space-y-2">
        <Label htmlFor="status-note">הערה (לא חובה)</Label>
        <Input id="status-note" name="note" placeholder="מה השתנה" />
      </div>
      <SubmitButton label="עדכון" />
    </form>
  );
}

/** בורר שלב, נשמר מיד עם הבחירה. */
export function StatusSelect({
  id,
  status,
  kind,
}: {
  id: string;
  status: ProjectStatus;
  kind: "project" | "task";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = kind === "project" ? updateProjectStatus : updateProjectTaskStatus;

  return (
    <form ref={formRef} action={action.bind(null, id)}>
      <NativeSelect
        key={status}
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-8 w-40 text-xs"
        aria-label="שלב"
      >
        {statusOptions(kind, status).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </form>
  );
}

/**
 * טופס עבודה חד-פעמית - משמש גם ליצירה וגם לעריכה, לפרויקט ולתיק קבלנות משנה.
 *
 * הסוג נבחר בטופס ומשנה את התוויות: בקבלנות משנה "השותף" הוא המשרד שהעביר
 * את העבודה, ותיק חדש מתחיל ב"התקבל וטרם הותחל" ולא ב"בעבודה".
 */
export function ProjectForm({
  project,
  defaultKind = "PROJECT",
}: {
  project?: Project;
  defaultKind?: ProjectKind;
}) {
  const action = project ? updateProject.bind(null, project.id) : createProject;
  const [state, formAction] = useActionState<ProjectFormState, FormData>(action, {});
  const [kind, setKind] = useState<ProjectKind>(project?.kind ?? defaultKind);
  const errors = state.fieldErrors ?? {};
  const isSubcontract = kind === "SUBCONTRACT";

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kind">סוג</Label>
          <NativeSelect
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.currentTarget.value as ProjectKind)}
          >
            {toOptions(projectKindLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">{isSubcontract ? "שם התיק *" : "שם הפרויקט *"}</Label>
          <Input id="name" name="name" defaultValue={project?.name ?? ""} required />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner">{projectPartnerLabels[kind]}</Label>
          <Input
            id="partner"
            name="partner"
            placeholder="למשל: משרד רו״ח כהן"
            defaultValue={project?.partner ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">שלב</Label>
          <NativeSelect
            id="status"
            name="status"
            key={kind}
            defaultValue={project?.status ?? (isSubcontract ? "RECEIVED" : "IN_PROGRESS")}
          >
            {toOptions(projectStatusLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fee">שכר טרחה (₪)</Label>
          <Input
            id="fee"
            name="fee"
            type="number"
            min="0"
            max="99999999.99"
            step="0.01"
            dir="ltr"
            className="text-right"
            defaultValue={project?.fee ? String(project.fee) : ""}
          />
          {errors.fee && <p className="text-sm text-destructive">{errors.fee}</p>}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">הערות</Label>
          <Input id="notes" name="notes" defaultValue={project?.notes ?? ""} />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton
        label={project ? "שמירת שינויים" : isSubcontract ? "פתיחת תיק" : "יצירת פרויקט"}
      />
    </form>
  );
}

/**
 * כפתור הסימון עצמו.
 *
 * מופרד לרכיב-בן במכוון: `useFormStatus` מחזיר מצב רק עבור `<form>` שנמצא
 * **מעליו** בעץ. קריאה לו באותו רכיב שמרנדר את הטופס הייתה מחזירה תמיד
 * `false`, הכפתור לא היה ננעל, ולחיצה כפולה מהירה הייתה הופכת את הסימון פעמיים.
 */
function PaidButton({
  project,
}: {
  project: Pick<Project, "isPaid" | "paidAt">;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      className={cn(
        project.isPaid
          ? "border-accent text-accent hover:bg-accent/10"
          : "border-destructive/50 text-destructive hover:bg-destructive/10",
      )}
      title={
        project.isPaid && project.paidAt
          ? `שולם ב-${formatDate(project.paidAt)} — לחיצה מבטלת`
          : "לחיצה מסמנת שהתקבל תשלום"
      }
    >
      {pending ? "שומר..." : project.isPaid ? "שולם ✓" : "טרם שולם"}
    </Button>
  );
}

/** סימון גבייה. מוצג בכרטיס העבודה וברשימה, כי זה מה שנשכח אחרי שהעבודה נגמרה. */
export function PaidToggle({
  project,
}: {
  project: Pick<Project, "id" | "isPaid" | "fee" | "paidAt">;
}) {
  return (
    <form action={toggleProjectPaid.bind(null, project.id)} className="inline">
      <PaidButton project={project} />
    </form>
  );
}

/** הוספת משימה לפרויקט, ישירות מתוך המסך. */
export function AddProjectTaskForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState<ProjectFormState, FormData>(
    createProjectTask.bind(null, projectId),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-52 flex-1 space-y-2">
        <Label htmlFor="task-title">משימה</Label>
        <Input id="task-title" name="title" placeholder="מה צריך לעשות" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-due">מועד</Label>
        <DateField id="task-due" name="dueDate" className="w-40" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-status">שלב</Label>
        <NativeSelect
          id="task-status"
          name="status"
          defaultValue="IN_PROGRESS"
          className="w-40"
        >
          {statusOptions("task").map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <SubmitButton label="הוספה" />
      {state.error && (
        <p className="w-full text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}

export function DeleteProjectTaskButton({ task }: { task: ProjectTask }) {
  return (
    <form
      action={deleteProjectTask.bind(null, task.id)}
      onSubmit={(e) => {
        if (!confirm(`למחוק את "${task.title}"?`)) e.preventDefault();
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

export function DeleteProjectButton({ project }: { project: Project }) {
  return (
    <form
      action={deleteProject.bind(null, project.id)}
      onSubmit={(e) => {
        if (
          !confirm(`למחוק את הפרויקט "${project.name}" ואת כל המשימות שלו? הפעולה אינה הפיכה.`)
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10"
      >
        מחיקה
      </Button>
    </form>
  );
}

/** טופס יצירה מקופל, כדי שרשימת הפרויקטים תישאר נקייה. */
export function NewProjectSection({
  defaultKind = "PROJECT",
}: {
  defaultKind?: ProjectKind;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        {defaultKind === "SUBCONTRACT" ? "תיק חדש" : "פרויקט חדש"}
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border p-4">
      <ProjectForm defaultKind={defaultKind} />
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        ביטול
      </Button>
    </div>
  );
}
