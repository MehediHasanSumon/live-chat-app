"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  defaultToToday?: boolean;
  name?: string;
  className?: string;
};

const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});
const displayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
});

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isSameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function getCalendarDays(displayMonth: Date) {
  const firstDayOfMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
  const gridStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1 - firstDayOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      isCurrentMonth: date.getMonth() === displayMonth.getMonth(),
    };
  });
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "mm/dd/yyyy",
  defaultToToday = true,
  name,
  className,
}: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hasDefaultedRef = useRef(false);
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const [displayMonth, setDisplayMonth] = useState<Date>(() => selectedDate ?? today);
  const calendarDays = useMemo(() => getCalendarDays(displayMonth), [displayMonth]);

  useEffect(() => {
    if (defaultToToday && !value && !hasDefaultedRef.current) {
      hasDefaultedRef.current = true;
      onChange(formatDateValue(today));
    }
  }, [defaultToToday, onChange, today, value]);

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

  const displayValue = selectedDate ? displayFormatter.format(selectedDate) : placeholder;

  function moveMonth(direction: number) {
    setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function selectDate(date: Date) {
    onChange(formatDateValue(date));
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        className={cn(
          "pill-input flex h-9 w-full items-center justify-between px-3 text-left text-sm outline-none transition focus:border-[var(--accent)]",
          disabled && "cursor-not-allowed opacity-60",
          !selectedDate && "text-[var(--muted)]",
        )}
        disabled={disabled}
        onClick={() => {
          if (!isOpen) {
            setDisplayMonth(selectedDate ?? new Date());
          }

          setIsOpen((current) => !current);
        }}
      >
        <span>{displayValue}</span>
        <CalendarDays className="h-4 w-4 text-[var(--muted)]" />
      </button>

      <div
        className={cn(
          "absolute left-0 top-[calc(100%+8px)] z-50 w-[296px] origin-top rounded-lg border border-[var(--line)] bg-white p-3 shadow-[0_22px_55px_rgba(30,34,45,0.18)] transition-all duration-200 ease-out",
          isOpen && !disabled ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-1 scale-95 opacity-0",
          disabled ? "pointer-events-none" : isOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div className="rounded-md bg-white">
          <div className="mb-3 flex h-8 items-center justify-between">
            <p className="text-sm font-semibold text-[#1f2440]">{monthFormatter.format(displayMonth)}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                aria-label="Previous month"
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                aria-label="Next month"
                onClick={() => moveMonth(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {weekDays.map((day) => (
              <div key={day} className="py-1 text-xs font-semibold text-[#2d3150]">
                {day}
              </div>
            ))}
            {calendarDays.map(({ date, isCurrentMonth }) => {
              const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
              const isToday = isSameDay(date, today);

              return (
                <button
                  key={formatDateValue(date)}
                  type="button"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-sm transition duration-150",
                    isCurrentMonth ? "text-[#1f2440]" : "text-[var(--muted)] opacity-70",
                    isToday && !isSelected && "border border-[var(--accent)] text-[var(--accent)]",
                    isSelected && "bg-[var(--accent)] font-semibold text-white shadow-sm",
                    !isSelected && "hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:shadow-sm",
                  )}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex h-8 items-center justify-between border-t border-[var(--line)] pt-1">
            <button
              type="button"
              className="inline-flex h-6 items-center justify-center rounded px-2 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
              onClick={() => onChange("")}
            >
              <span>Clear</span>
            </button>
            <button
              type="button"
              className="inline-flex h-6 items-center justify-center rounded px-2 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
              onClick={() => selectDate(today)}
            >
              <span>Today</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
