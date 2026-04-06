"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type MessagesAccordionSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function MessagesAccordionSection({
  title,
  defaultOpen = false,
  children,
}: MessagesAccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between px-1 py-1.5 text-left"
      >
        <p className="text-[13px] font-semibold">{title}</p>
        <ChevronDown
          className={`h-4 w-4 text-[var(--muted)] transition-transform duration-300 ease-out ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
          isOpen ? "mt-2 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-1 pb-1">{children}</div>
        </div>
      </div>
    </section>
  );
}
