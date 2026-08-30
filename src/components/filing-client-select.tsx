"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * בחירת הלקוח בתצוגת "לפי לקוח". רשימה נפתחת ולא כפתורים, כי יש עשרות לקוחות.
 * הכתובת נבנית כאן ולא בשרת, כי אי אפשר להעביר פונקציה כ-prop לרכיב לקוח.
 */
export function FilingClientSelect({
  clients,
  value,
  query,
}: {
  clients: { id: string; businessName: string }[];
  value: string;
  query: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <NativeSelect
      key={value}
      defaultValue={value}
      aria-label="בחירת לקוח"
      className="w-64"
      onChange={(e) => {
        const params = new URLSearchParams({ ...query, client: e.currentTarget.value });
        router.push(`/filings?${params.toString()}`);
      }}
    >
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.businessName}
        </option>
      ))}
    </NativeSelect>
  );
}
