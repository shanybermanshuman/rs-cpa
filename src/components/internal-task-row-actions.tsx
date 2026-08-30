"use client";

import { useRef } from "react";
import type { TaskStatus } from "@/generated/prisma/client";
import {
  deleteInternalTask,
  updateInternalTaskStatus,
} from "@/app/internal-tasks/actions";
import { taskStatusLabels, toOptions } from "@/lib/enums";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";

export function InternalTaskStatusSelect({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateInternalTaskStatus.bind(null, taskId)}>
      <NativeSelect
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-8 w-36 text-xs"
        aria-label="סטטוס המשימה"
      >
        {toOptions(taskStatusLabels).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </form>
  );
}

export function DeleteInternalTaskButton({
  taskId,
  title,
}: {
  taskId: string;
  title: string;
}) {
  return (
    <form
      action={deleteInternalTask.bind(null, taskId)}
      onSubmit={(event) => {
        if (!confirm(`למחוק את המשימה "${title}"? הפעולה אינה הפיכה.`)) {
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
