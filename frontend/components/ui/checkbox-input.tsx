import { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type CheckboxInputProps = InputHTMLAttributes<HTMLInputElement>;

export function CheckboxInput({ className, type = "checkbox", ...props }: CheckboxInputProps) {
  return (
    <input
      type={type}
      className={cn("h-4 w-4 rounded-sm border border-[var(--line)] accent-[var(--accent)]", className)}
      {...props}
    />
  );
}
