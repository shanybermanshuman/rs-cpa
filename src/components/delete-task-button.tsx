"use client";

import { deleteClientTask } from "@/app/tasks/task-actions";
import { Button } from "@/components/ui/button";

export function DeleteTaskButton({ taskId }: { taskId: string }) {
  return (
    <form
      action={deleteClientTask.bind(null, taskId)}
      onSubmit={(event) => {
        if (!confirm("למחוק את המשימה? הפעולה אינה הפיכה.")) {
          event.preventDefault();
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
