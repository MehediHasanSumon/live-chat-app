"use client";

import { memo } from "react";
import Link from "next/link";
import { Ellipsis } from "lucide-react";

import { type MessageThread } from "@/lib/messages-data";
import { MessageAvatar } from "@/components/messages/message-avatar";

type MessageThreadItemProps = {
  thread: MessageThread;
  isActive: boolean;
  isMenuOpen: boolean;
  onOpenMenu: (threadId: string, event: React.MouseEvent<HTMLButtonElement>) => void;
  onSelect: (threadId: string) => void;
};

function MessageThreadItemComponent({
  thread,
  isActive,
  isMenuOpen,
  onOpenMenu,
  onSelect,
}: MessageThreadItemProps) {
  return (
    <div className="relative">
      <Link
        href={`/messages/t/${thread.id}`}
        onClick={() => onSelect(thread.id)}
        className={`block rounded-xl border px-3 py-3 pr-12 transition ${
          isActive
            ? "border-[rgba(96,91,255,0.24)] bg-[var(--accent-soft)]"
            : "border-transparent bg-white/60 hover:border-[var(--line)] hover:bg-white"
        }`}
      >
        <div className="flex items-start gap-3">
          <MessageAvatar name={thread.name} online={thread.online} imageUrl={thread.avatarUrl} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">{thread.name}</p>
              <span className="shrink-0 text-xs text-[var(--muted)]">{thread.time}</span>
            </div>
            <p className="mt-1.5 truncate text-sm text-[var(--muted)]">{thread.lastMessage}</p>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={(event) => onOpenMenu(thread.id, event)}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        aria-label={`Open actions for ${thread.name}`}
        className={`absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[var(--muted)] transition hover:text-[var(--accent)] ${
          isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      >
        <Ellipsis className="h-4 w-4" />
      </button>

      {thread.unreadCount && !isActive ? (
        <span
          className={`absolute right-3 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-semibold text-white transition ${
            isMenuOpen ? "opacity-0" : "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0"
          }`}
        >
          {thread.unreadCount}
        </span>
      ) : null}
    </div>
  );
}

export const MessageThreadItem = memo(MessageThreadItemComponent, (prev, next) =>
  prev.thread === next.thread &&
  prev.isActive === next.isActive &&
  prev.isMenuOpen === next.isMenuOpen &&
  prev.onOpenMenu === next.onOpenMenu &&
  prev.onSelect === next.onSelect,
);
