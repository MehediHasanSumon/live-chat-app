"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SelectInputOption = {
  value: string;
  label: string;
};

type SelectInputProps = {
  value: string;
  options: SelectInputOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  dropdownLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function SelectInput({
  value,
  options,
  onChange,
  placeholder = "Select option",
  dropdownLabel,
  disabled = false,
  className,
  triggerClassName,
}: SelectInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleDocumentPress(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentPress);
    document.addEventListener("touchstart", handleDocumentPress);

    return () => {
      document.removeEventListener("mousedown", handleDocumentPress);
      document.removeEventListener("touchstart", handleDocumentPress);
    };
  }, [isOpen]);

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", isOpen && "z-[80]", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        className={cn(
          "pill-input flex h-9 w-full items-center justify-between gap-3 bg-white/85 px-3 text-left text-sm text-[#1f2440] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition",
          "hover:border-[rgba(96,91,255,0.28)] hover:bg-white focus:border-[var(--accent)]",
          disabled && "cursor-not-allowed opacity-60",
          !selectedOption && "text-[var(--muted)]",
          triggerClassName,
        )}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--muted)] transition", isOpen && "rotate-180 text-[var(--accent)]")} />
      </button>

      <div
        role="listbox"
        className={cn(
          "absolute left-0 top-[calc(100%+8px)] z-[80] min-w-full overflow-hidden rounded-lg border border-[rgba(99,109,152,0.16)] bg-white p-2 shadow-[0_22px_54px_rgba(40,45,78,0.16)] transition-all duration-150 ease-out",
          isOpen && !disabled ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-1 scale-95 opacity-0",
          disabled ? "pointer-events-none" : isOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        {dropdownLabel ? <p className="px-2 pb-1 pt-0.5 text-xs font-semibold text-[var(--muted)]">{dropdownLabel}</p> : null}
        <div className="max-h-64 overflow-y-auto">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "flex h-8 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm font-semibold text-[#2d3150] transition",
                  "hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
                  isSelected && "bg-[var(--accent-soft)] text-[var(--accent)]",
                )}
                onClick={() => selectValue(option.value)}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
