import { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type RadioInputProps = InputHTMLAttributes<HTMLInputElement>;

export function RadioInput({ className, type = "radio", ...props }: RadioInputProps) {
  return (
    <input
      type={type}
      className={cn("h-4 w-4 border border-[var(--line)] accent-[var(--accent)]", className)}
      {...props}
    />
  );
}
