"use client";

import { InputHTMLAttributes, useState } from "react";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className, ...props }: TextInputProps) {
  const isPasswordField = props.type === "password";
  const [showPassword, setShowPassword] = useState(false);
  const inputType = isPasswordField && showPassword ? "text" : props.type;

  return (
    <div className="relative" suppressHydrationWarning>
      <input
        className={cn(
          "pill-input h-9 w-full px-3 text-sm outline-none transition focus:border-[var(--accent)]",
          isPasswordField && "pr-10",
          props.disabled && "cursor-not-allowed opacity-75",
          className,
        )}
        {...props}
        type={inputType}
      />

      {isPasswordField ? (
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword((value) => !value)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
}
