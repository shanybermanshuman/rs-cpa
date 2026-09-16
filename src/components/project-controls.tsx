"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Project, ProjectStatus, ProjectTask } from "@/generated/prisma/client";
import {
  createProject,
  createProjectTask,
  deleteProject,
  deleteProjectTask,
  updateProject,
  updateProjectStatus,
  updateProjectTaskStatus,
  type ProjectFormState,
} from "@/app/projects/actions";
import { projectStatusLabels, toOptions } from "@/lib/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "שומר..." : label}
    </Button>
  );
}

function toDateInputValue(d: Date | null | undefined) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
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
        {toOptions(projectStatusLabels).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </form>
  );
}

/** טופס פרויקט - משמש גם ליצירה וגם לעריכה. */
export function ProjectForm({ project }: { project?: Project }) {
  const action = project ? updateProject.bind(null, project.id) : createProject;
  const [state, formAction] = useActionState<ProjectFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">שם הפרויקט *</Label>
          <Input id="name" name="name" defaultValue={project?.name ?? ""} required />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner">שותף / גורם חיצוני</Label>
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
            defaultValue={project?.status ?? "IN_PROGRESS"}
          >
            {toOptions(projectStatusLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">הערות</Label>
          <Input id="notes" name="notes" defaultValue={project?.notes ?? ""} />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton label={project ? "שמירת שינויים" : "יצירת פרויקט"} />
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
          {toOptions(projectStatusLabels).map((o) => (
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
export function NewProjectSection() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>פרויקט חדש</Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border p-4">
      <ProjectForm />
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        ביטול
      </Button>
    </div>
  );
}
