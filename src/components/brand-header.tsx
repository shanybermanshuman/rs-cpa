import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * הלוגו הרשמי של המשרד. הקובץ נוצר מ-`לוגו.jpg` באמצעות
 * `npm run build:logo` (ראו scripts/build-logo.ts).
 *
 * הרקע לבן, ולכן הלוגו מוצג תמיד על משטח לבן.
 */
export function BrandHeader({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/logo.png"
        alt="סרנגה ושומן - רואות חשבון"
        width={767}
        height={222}
        priority
        className="h-auto w-60"
      />
    </div>
  );
}
