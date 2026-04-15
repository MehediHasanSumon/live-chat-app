import { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  variant?: "default" | "danger";
};

export function IconButton({ icon, className, type = "button", variant = "default", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border p-0 text-sm transition disabled:cursor-not-allowed disabled:opacity-45",
        variant === "default" && "border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-white",
        variant === "danger" && "border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-50",
        className,
      )}
      {...props}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center leading-none text-current">{icon}</span>
    </button>
  );
}
