import { LabelHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return <label className={cn("mb-2 block text-sm font-medium text-[var(--muted)]", className)} {...props} />;
}
