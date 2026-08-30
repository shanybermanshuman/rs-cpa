import { cn } from "@/lib/utils";

/**
 * רכיב בחירה מבוסס <select> רגיל. נבחר במכוון על פני רכיב Select של shadcn
 * כדי שהערך ישלח כחלק מה-form באופן טבעי (ללא שדות נסתרים) ויתנהג נכון ב-RTL.
 */
export function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
