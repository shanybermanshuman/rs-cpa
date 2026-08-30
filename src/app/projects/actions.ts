"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { optionalDate, optionalText } from "@/lib/form-schema";

const statusEnum = z.enum(["IN_PROGRESS", "WAITING_DOCS", "WAITING_REPLY", "DONE"]);

const projectSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם לפרויקט"),
  partner: optionalText,
  status: statusEnum,
  notes: optionalText,
});

const taskSchema = z.object({
  title: z.string().trim().min(1, "יש להזין תיאור למשימה"),
  dueDate: optionalDate,
  status: statusEnum,
  notes: optionalText,
});

export type ProjectFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** מסומן רק אחרי שמירה שהצליחה - ראו ההסבר ב-contact-actions.ts */
  ok?: boolean;
};

function toFieldErrors(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message]));
}

function revalidateProjects(projectId?: string) {
  revalidatePath("/projects");
  revalidatePath("/");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      // רישום פתיחת הפרויקט, כדי שההיסטוריה תתחיל מהתחלה
      history: {
        create: { toStatus: parsed.data.status, changedById: user.id, note: "נפתח" },
      },
    },
  });
  revalidateProjects();
  redirect(`/projects/${project.id}`);
}

export async function updateProject(
  projectId: string,
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const before = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });

  await prisma.project.update({ where: { id: projectId }, data: parsed.data });

  // גם שינוי שלב מתוך טופס הפרטים נרשם ביומן
  if (before && before.status !== parsed.data.status) {
    await prisma.projectStatusChange.create({
      data: {
        projectId,
        fromStatus: before.status,
        toStatus: parsed.data.status,
        changedById: user.id,
      },
    });
  }

  revalidateProjects(projectId);
  redirect(`/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.project.delete({ where: { id: projectId } });
  revalidateProjects();
  redirect("/projects");
}

/**
 * שינוי שלב הפרויקט, עם רישום ביומן.
 * כל מעבר נשמר כדי שאפשר יהיה לראות איך הפרויקט התקדם לאורך זמן.
 */
export async function updateProjectStatus(projectId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const parsed = statusEnum.safeParse(formData.get("status"));
  if (!parsed.success) return;

  const note = String(formData.get("note") ?? "").trim() || null;

  const current = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });
  if (!current) return;

  // שלב זהה ובלי הערה - אין מה לרשום
  if (current.status === parsed.data && !note) return;

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { status: parsed.data },
    }),
    prisma.projectStatusChange.create({
      data: {
        projectId,
        fromStatus: current.status,
        toStatus: parsed.data,
        note,
        changedById: user.id,
      },
    }),
  ]);

  revalidateProjects(projectId);
}

export async function createProjectTask(
  projectId: string,
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "אין הרשאה." };

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "יש לתקן את השדות המסומנים.", fieldErrors: toFieldErrors(parsed.error) };
  }

  await prisma.projectTask.create({ data: { ...parsed.data, projectId } });
  revalidateProjects(projectId);
  return { ok: true };
}

export async function updateProjectTaskStatus(taskId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const parsed = statusEnum.safeParse(formData.get("status"));
  if (!parsed.success) return;

  const task = await prisma.projectTask.update({
    where: { id: taskId },
    data: {
      status: parsed.data,
      completedAt: parsed.data === "DONE" ? new Date() : null,
    },
  });
  revalidateProjects(task.projectId);
}

export async function deleteProjectTask(taskId: string) {
  const user = await getCurrentUser();
  if (!user) return;

  const task = await prisma.projectTask.delete({ where: { id: taskId } });
  revalidateProjects(task.projectId);
}
