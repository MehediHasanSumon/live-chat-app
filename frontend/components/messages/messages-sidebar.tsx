"use client";

import Link from "next/link";
import { KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";

import {
  Archive,
  Bell,
  CheckCheck,
  Ellipsis,
  Inbox,
  MessageCircleOff,
  Phone,
  ShieldBan,
  Search,
  SquarePen,
  Trash2,
  Video,
} from "lucide-react";

import { messageThreads } from "@/lib/messages-data";

type MessagesSidebarProps = {
  activeThreadId?: string;
};

const filters = ["All", "Unread", "Groups", "Communities"] as const;

const threadMenuItems = [
  { label: "Mark as unread", icon: CheckCheck },
  { label: "Mute notifications", icon: Bell },
  { label: "Audio call", icon: Phone },
  { label: "Video chat", icon: Video },
  { label: "Block", icon: MessageCircleOff },
  { label: "Archive chat", icon: Archive },
  { label: "Delete chat", icon: Trash2 },
];

const sidebarMenuItems = [
  { label: "Message requests", icon: Inbox },
  { label: "Archived chats", icon: Archive },
  { label: "Blocked accounts", icon: ShieldBan },
];

export function MessagesSidebar({ activeThreadId }: MessagesSidebarProps) {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("All");
  const [openMenuThreadId, setOpenMenuThreadId] = useState<string | null>(null);
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!sidebarRef.current?.contains(event.target as Node)) {
        setOpenMenuThreadId(null);
        setIsSidebarMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuThreadId(null);
        setIsSidebarMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <aside ref={sidebarRef} className="surface border-r border-[var(--line)] px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[1.15rem] font-semibold tracking-tight text-[var(--foreground)]">Messages</p>
        <div className="relative flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsSidebarMenuOpen((value) => !value);
              setOpenMenuThreadId(null);
            }}
            aria-expanded={isSidebarMenuOpen}
            aria-haspopup="menu"
            aria-label="Open message list options"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--muted)] transition hover:border-[rgba(96,91,255,0.24)] hover:text-[var(--accent)]"
          >
            <Ellipsis className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--muted)] transition hover:border-[rgba(96,91,255,0.24)] hover:text-[var(--accent)]"
          >
            <SquarePen className="h-4 w-4" />
          </button>

          {isSidebarMenuOpen ? (
            <div
              role="menu"
              className="absolute -right-24 top-11 z-30 w-[260px] rounded-2xl border border-[var(--line)] bg-white p-2 shadow-[0_20px_50px_rgba(35,37,58,0.12)]"
            >
              {sidebarMenuItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  role="menuitem"
                  onClick={() => setIsSidebarMenuOpen(false)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"
                >
                  <Icon className="h-4 w-4 text-[var(--muted)]" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="pill-input mt-4 flex h-10 items-center gap-2 px-3 text-sm text-[var(--muted)]">
        <Search className="h-4 w-4" />
        <span>Search Messenger</span>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1">
          {filters.map((filter) => (
            <span
              key={filter}
              role="button"
              tabIndex={0}
              onClick={() => setActiveFilter(filter)}
              onKeyDown={(event: ReactKeyboardEvent<HTMLSpanElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveFilter(filter);
                }
              }}
              className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[12px] leading-none font-medium transition ${
                activeFilter === filter
                  ? "bg-[var(--accent)] text-white"
                  : "bg-transparent text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
              }`}
            >
              {filter}
            </span>
          ))}
      </div>

      <div className="mt-4 space-y-2">
        {messageThreads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isMenuOpen = openMenuThreadId === thread.id;

          return (
            <div key={thread.id} className="group relative">
              <Link
                href={`/messages/t/${thread.id}`}
                onClick={() => {
                  setOpenMenuThreadId(null);
                  setIsSidebarMenuOpen(false);
                }}
                className={`block rounded-xl border px-3 py-3 transition ${isActive
                  ? "border-[rgba(96,91,255,0.24)] bg-[var(--accent-soft)]"
                  : "border-transparent bg-white/60 hover:border-[var(--line)] hover:bg-white"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
                    {thread.name.slice(0, 1)}
                    {thread.online ? (
                      <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{thread.name}</p>
                      <span className="shrink-0 text-xs text-[var(--muted)]">{thread.time}</span>
                    </div>
                    <p className="mt-1.5 truncate text-sm text-[var(--muted)]">{thread.lastMessage}</p>
                  </div>

                  <div className="flex min-h-full w-8 items-center justify-center">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsSidebarMenuOpen(false);
                        setOpenMenuThreadId((value) => (value === thread.id ? null : thread.id));
                      }}
                      aria-expanded={isMenuOpen}
                      aria-haspopup="menu"
                      aria-label={`Open actions for ${thread.name}`}
                      className={`absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[var(--muted)] transition hover:text-[var(--accent)] ${
                        isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                      }`}
                    >
                      <Ellipsis className="h-4 w-4" />
                    </button>

                    {thread.unreadCount ? (
                      <span
                        className={`absolute right-3 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-semibold text-white transition ${
                          isMenuOpen ? "opacity-0" : "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0"
                        }`}
                      >
                        {thread.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>

              {isMenuOpen ? (
                <div
                  role="menu"
                  className="absolute -right-10 top-14 z-20 w-[260px] rounded-2xl border border-[var(--line)] bg-white p-2 shadow-[0_20px_50px_rgba(35,37,58,0.12)]"
                >
                  {threadMenuItems.map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      role="menuitem"
                      onClick={() => setOpenMenuThreadId(null)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"
                    >
                      <Icon className="h-4 w-4 text-[var(--muted)]" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
