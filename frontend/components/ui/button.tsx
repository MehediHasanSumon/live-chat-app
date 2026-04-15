import { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost" | "outline" | "soft" | "danger" | "danger-soft";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  as?: "button" | "span";
  disabled?: boolean;
};

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonBaseProps & {
    as?: "button";
  };

type SpanButtonProps = HTMLAttributes<HTMLSpanElement> &
  ButtonBaseProps & {
    as: "span";
    type?: never;
  };

type ButtonProps = NativeButtonProps | SpanButtonProps;

function buttonClassName({
  className,
  disabled,
  size,
  variant,
}: {
  className?: string;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "outline" | "soft" | "danger" | "danger-soft";
  size?: "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";
}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
    disabled && "cursor-not-allowed opacity-45",
    variant === "primary" && "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
    variant === "ghost" && "text-[var(--accent)] hover:bg-[var(--accent-soft)]",
    variant === "outline" && "border border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-white",
    variant === "soft" && "bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[rgba(96,91,255,0.16)]",
    variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
    variant === "danger-soft" && "border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-50",
    size === "xs" && "h-8 gap-1.5 rounded-full px-3 text-xs font-medium",
    size === "sm" && "h-9 gap-2 rounded-full px-4 text-sm",
    size === "md" && "h-9 gap-2 rounded-md px-4 text-sm",
    size === "lg" && "h-11 gap-2 rounded-md px-5 text-base",
    size === "icon" && "h-9 w-9 rounded-md p-0 text-sm",
    size === "icon-sm" && "h-8 w-8 rounded-md p-0 text-xs",
    className,
  );
}

export function Button({ as = "button", className, disabled, size = "md", variant = "primary", ...props }: ButtonProps) {
  const classes = buttonClassName({ className, disabled, size, variant });

  if (as === "span") {
    const { onClick, onKeyDown, tabIndex, ...spanProps } = props as SpanButtonProps;

    return (
      <span
        role="button"
        tabIndex={disabled ? -1 : (tabIndex ?? 0)}
        aria-disabled={disabled || undefined}
        className={cn(classes, !disabled && "cursor-pointer")}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }

          onClick?.(event);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
          onKeyDown?.(event);

          if (event.defaultPrevented || disabled || (event.key !== "Enter" && event.key !== " ")) {
            return;
          }

          event.preventDefault();
          event.currentTarget.click();
        }}
        {...spanProps}
      />
    );
  }

  const { type = "button", ...buttonProps } = props as NativeButtonProps;

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      {...buttonProps}
    />
  );
}
