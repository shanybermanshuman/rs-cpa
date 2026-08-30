import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/**
 * אריח מספרי בלוח הבקרה. `tone` קובע את ההדגשה: משימות באיחור מודגשות
 * באדום כדי שיהיו הדבר הראשון שנתפס בעין.
 */
export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  href?: string;
  tone?: "default" | "danger" | "accent";
}) {
  const content = (
    <Card
      className={cn(
        "h-full transition-colors",
        href && "hover:border-accent",
        tone === "danger" && value > 0 && "border-destructive/40 bg-destructive/5",
      )}
    >
      <CardContent className="space-y-1 pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-3xl font-semibold tabular-nums",
            tone === "danger" && value > 0 && "text-destructive",
            tone === "accent" && "text-accent",
          )}
        >
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
