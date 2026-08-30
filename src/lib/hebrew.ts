/**
 * ניסוח כמויות בעברית תקנית.
 * בעברית יש צורת יחיד וצורת זוגי נפרדות, ולכן "1 משימות" ו-"2 משימות" צורמים.
 */
export function countLabel(
  count: number,
  forms: { one: string; two: string; many: string },
): string {
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  return `${count} ${forms.many}`;
}

export const TASK_FORMS = {
  one: "משימה אחת",
  two: "שתי משימות",
  many: "משימות",
} as const;

export const OPEN_TASK_FORMS = {
  one: "משימה פתוחה אחת",
  two: "שתי משימות פתוחות",
  many: "משימות פתוחות",
} as const;

export const CLIENT_FORMS = {
  one: "לקוח אחד",
  two: "שני לקוחות",
  many: "לקוחות",
} as const;
