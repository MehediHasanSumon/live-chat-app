"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Archive,
  Bell,
  CheckCheck,
  Inbox,
  MessageCircleOff,
  Phone,
  ShieldBan,
  Trash2,
  Video,
} from "lucide-react";

import { toConversationThread } from "@/lib/messages-data";
import { MessagesFilterTabs } from "@/components/messages/messages-filter-tabs";
import { MessagesSearchBar } from "@/components/messages/messages-search-bar";
import { MessagesSidebarHeader } from "@/components/messages/messages-sidebar-header";
import { MessagesThreadMenu } from "@/components/messages/messages-thread-menu";
import { MessageThreadItem } from "@/components/messages/message-thread-item";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";

type MessagesSidebarProps = {
  activeThreadId?: string;
  onOpenMuteModal?: () => void;
  onOpenConfirmation?: (action: "block" | "delete") => void;
  onOpenNewMessageModal?: () => void;
};

const filters = ["All", "Unread", "Groups"] as const;

const threadMenuItems = [
  { label: "Mark as unread", icon: CheckCheck },
  { label: "Mute notifications", icon: Bell },
  { label: "Audio call", icon: Phone },
  { label: "Video chat", icon: Video },
  { label: "Block", icon: MessageCircleOff },
  { label: "Archive chat", icon: Archive },
  { label: "Delete chat", icon: Trash2 },
];

export function MessagesSidebar({
  activeThreadId,
  onOpenMuteModal,
  onOpenConfirmation,
  onOpenNewMessageModal,
}: MessagesSidebarProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuThreadId, setOpenMenuThreadId] = useState<string | null>(null);
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const { data: conversations = [], isLoading, isError } = useConversationsQuery();
  const sidebarMenuItems = useMemo(
    () => [
      { label: "Message requests", icon: Inbox, onClick: () => router.push("/messages/requests") },
      { label: "Settings", icon: Bell, onClick: () => router.push("/settings") },
      { label: "Admin ops", icon: ShieldBan, onClick: () => router.push("/admin/ops") },
    ],
    [router],
  );

  const threads = useMemo(
    () => conversations.map((conversation) => toConversationThread(conversation)),
    [conversations],
  );

  const filteredThreads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return threads.filter((thread) => {
      const matchesFilter =
        activeFilter === "All"
          ? true
          : activeFilter === "Unread"
            ? Boolean(thread.unreadCount)
            : Boolean(thread.isGroup);

      if (!matchesFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        thread.name.toLowerCase().includes(normalizedQuery) ||
        thread.handle.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activeFilter, searchQuery, threads]);

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
    <aside ref={sidebarRef} className="surface h-full w-full border-r border-[var(--line)] px-4 py-4 sm:px-5">
      <MessagesSidebarHeader
        isMenuOpen={isSidebarMenuOpen}
        onToggleMenu={() => {
          setIsSidebarMenuOpen((value) => !value);
          setOpenMenuThreadId(null);
        }}
        menuItems={sidebarMenuItems}
        onCloseMenu={() => setIsSidebarMenuOpen(false)}
        onComposeClick={onOpenNewMessageModal}
      />

      <MessagesSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search conversations"
      />

      <MessagesFilterTabs
        filters={filters}
        activeFilter={activeFilter}
        onChange={(filter) => setActiveFilter(filter as (typeof filters)[number])}
      />

      <div className="mt-4 space-y-2">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`thread-skeleton-${index}`}
                className="animate-pulse rounded-xl border border-transparent bg-white/70 px-3 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-full bg-[var(--accent-soft)]" />
                  <div className="min-w-0 flex-1">
                    <div className="h-4 w-1/2 rounded bg-[var(--accent-soft)]" />
                    <div className="mt-2 h-3 w-5/6 rounded bg-[var(--accent-soft)]/80" />
                  </div>
                </div>
              </div>
            ))
          : null}

        {!isLoading && isError ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            We could not load conversations right now.
          </div>
        ) : null}

        {!isLoading && !isError && filteredThreads.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            {threads.length === 0
              ? "No conversations yet. Start one from the compose button when user search is ready."
              : "No conversations match this filter."}
          </div>
        ) : null}

        {filteredThreads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isMenuOpen = openMenuThreadId === thread.id;

          return (
            <div key={thread.id} className="group relative">
              <MessageThreadItem
                thread={thread}
                isActive={isActive}
                isMenuOpen={isMenuOpen}
                onSelect={() => {
                  setOpenMenuThreadId(null);
                  setIsSidebarMenuOpen(false);
                }}
                onOpenMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsSidebarMenuOpen(false);
                  setOpenMenuThreadId((value) => (value === thread.id ? null : thread.id));
                }}
              />

              {isMenuOpen ? (
                <MessagesThreadMenu
                  items={threadMenuItems}
                  onClose={() => setOpenMenuThreadId(null)}
                  onItemClick={(label) => {
                    if (label === "Mute notifications") {
                      onOpenMuteModal?.();
                    }
                    if (label === "Block") {
                      onOpenConfirmation?.("block");
                    }
                    if (label === "Delete chat") {
                      onOpenConfirmation?.("delete");
                    }
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
