"use client";

import { useRef } from "react";
import type { TaskStatus } from "@/generated/prisma/client";
import { updateTaskStatus } from "@/app/tasks/actions";
import { taskStatusLabels, toOptions } from "@/lib/enums";
import { NativeSelect } from "@/components/ui/native-select";

/** בורר סטטוס שנשמר מיד עם הבחירה, כדי לאפשר עדכון מהיר מתוך הרשימה. */
export function TaskStatusSelect({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateTaskStatus.bind(null, taskId)}>
      {/* key מכריח רינדור מחדש כשהסטטוס משתנה מבחוץ (למשל "סמן כהוגש") */}
      <NativeSelect
        key={status}
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-8 w-40 text-xs"
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
