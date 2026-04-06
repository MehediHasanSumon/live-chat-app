"use client";

import { useState } from "react";

import { Bell, ChevronDown, FileText, Image, Lock, Phone, Video } from "lucide-react";

import { type MessageThread } from "@/lib/messages-data";

type MessagesUserSidebarProps = {
  thread: MessageThread;
};

const mediaItems = [
  { label: "Media", icon: Image },
  { label: "Files", icon: FileText },
];

const privacyItems = [
  { label: "Mute notifications", icon: Bell },
  { label: "Verify end-to-end encryption", icon: Lock },
];

const quickActions = [
  { label: "Audio call", icon: Phone },
  { label: "Video call", icon: Video },
  { label: "Mute", icon: Bell },
];

function ListRow({
  label,
  trailing,
  icon: Icon,
}: {
  label: string;
  trailing?: string;
  icon: typeof Bell;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition hover:text-[var(--accent)]"
    >
      <Icon className="h-4 w-4 shrink-0 text-[var(--muted)]" />
      <span className="flex-1 text-[13px]">{label}</span>
      {trailing ? <span className="text-xs text-[var(--muted)]">{trailing}</span> : null}
    </button>
  );
}

function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between px-1 py-1.5 text-left"
      >
        <p className="text-[13px] font-semibold">{title}</p>
        <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? <div className="mt-2 space-y-1">{children}</div> : null}
    </section>
  );
}

export function MessagesUserSidebar({ thread }: MessagesUserSidebarProps) {
  return (
    <aside className="surface hidden border-l border-[var(--line)] bg-[#fbfcff] lg:block">
      <div className="h-[calc(100vh-2rem)] overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-soft)] text-2xl font-semibold text-[var(--accent)]">
            {thread.name.slice(0, 1)}
            {thread.online ? (
              <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            ) : null}
          </div>

          <h2 className="mt-4 text-lg font-semibold tracking-tight">{thread.name}</h2>
          <div className="mt-3 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
            End-to-end encrypted
          </div>

          <div className="mt-5 flex gap-0.5">
            {quickActions.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                className="flex items-center justify-center rounded-2xl bg-white px-2 py-4 transition hover:border-[rgba(96,91,255,0.24)] hover:text-[var(--accent)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <AccordionSection title="Media & files">
            {mediaItems.map((item) => (
              <ListRow key={item.label} label={item.label} icon={item.icon} />
            ))}
          </AccordionSection>

          <AccordionSection title="Privacy & support">
            {privacyItems.map((item) => (
              <ListRow key={item.label} label={item.label} icon={item.icon} />
            ))}
          </AccordionSection>
        </div>
      </div>
    </aside>
  );
}
