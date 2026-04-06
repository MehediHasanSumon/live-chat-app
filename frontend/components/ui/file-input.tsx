import { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type FileInputProps = InputHTMLAttributes<HTMLInputElement>;

export function FileInput({ className, type = "file", ...props }: FileInputProps) {
  return (
    <input
      type={type}
      className={cn(
        "pill-input h-9 w-full px-3 text-sm text-[var(--muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--accent)]",
        className,
      )}
      {...props}
    />
  );
}
