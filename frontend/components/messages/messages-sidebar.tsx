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

import { applyPresenceToThread, toConversationThread } from "@/lib/messages-data";
import { MessagesFilterTabs } from "@/components/messages/messages-filter-tabs";
import { MessagesSearchBar } from "@/components/messages/messages-search-bar";
import { MessagesSidebarHeader } from "@/components/messages/messages-sidebar-header";
import { MessagesThreadMenu } from "@/components/messages/messages-thread-menu";
import { MessageThreadItem } from "@/components/messages/message-thread-item";
import {
  useArchiveConversationMutation,
  useMarkConversationUnreadMutation,
  useSetConversationMuteMutation,
} from "@/lib/hooks/use-conversation-actions";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { useMarkConversationReadMutation } from "@/lib/hooks/use-mark-read-mutation";
import { useConversationPresenceMap } from "@/lib/hooks/use-user-presence-query";

type MessagesSidebarProps = {
  activeThreadId?: string;
  onOpenMuteModal?: (threadId?: string | null) => void;
  onOpenConfirmation?: (action: "block" | "delete", threadId?: string | null) => void;
  onOpenNewMessageModal?: () => void;
};

const filters = ["All", "Unread", "Groups"] as const;

function isThreadMuted(mutedUntil: string | null | undefined) {
  if (!mutedUntil) {
    return false;
  }

  const mutedDate = new Date(mutedUntil);

  return !Number.isNaN(mutedDate.getTime()) && mutedDate.getTime() > Date.now();
}

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
  const openMenuThreadIdRef = useRef<string | null>(null);
  const { data: conversations = [], isLoading, isError } = useConversationsQuery();
  const archiveConversationMutation = useArchiveConversationMutation();
  const markConversationReadMutation = useMarkConversationReadMutation();
  const markConversationUnreadMutation = useMarkConversationUnreadMutation();
  const setConversationMuteMutation = useSetConversationMuteMutation();
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
  const presenceMap = useConversationPresenceMap(threads);
  const threadsWithPresence = useMemo(
    () => threads.map((thread) => applyPresenceToThread(thread, presenceMap[thread.id])),
    [presenceMap, threads],
  );
  const visibleThreads = useMemo(
    () => threadsWithPresence.filter((thread) => !thread.membership?.archived_at),
    [threadsWithPresence],
  );

  const filteredThreads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return visibleThreads.filter((thread) => {
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
  }, [activeFilter, searchQuery, visibleThreads]);

  useEffect(() => {
    openMenuThreadIdRef.current = openMenuThreadId;
  }, [openMenuThreadId]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const activeMenuBoundary = target?.closest("[data-thread-menu-boundary='true']");
      const activeMenuThreadId = activeMenuBoundary?.getAttribute("data-thread-id");
      const currentOpenMenuThreadId = openMenuThreadIdRef.current;

      if (currentOpenMenuThreadId && activeMenuThreadId !== currentOpenMenuThreadId) {
        setOpenMenuThreadId(null);
      }

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
            {visibleThreads.length === 0
              ? "No conversations yet. Start one from the compose button when user search is ready."
              : "No conversations match this filter."}
          </div>
        ) : null}

        {filteredThreads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isMenuOpen = openMenuThreadId === thread.id;
          const hasUnreadMessages = Boolean(thread.unreadCount);
          const readToggleLabel = hasUnreadMessages ? "Mark as read" : "Mark as unread";
          const muted = isThreadMuted(thread.membership?.muted_until);
          const muteLabel = muted ? "Unmute notifications" : "Mute notifications";
          const menuItems = [
            { label: readToggleLabel, icon: CheckCheck },
            { label: muteLabel, icon: Bell },
            { label: "Audio call", icon: Phone, disabled: true },
            { label: "Video chat", icon: Video, disabled: true },
            ...(!thread.isGroup ? [{ label: "Block", icon: MessageCircleOff }] : []),
            { label: "Archive chat", icon: Archive },
            { label: "Delete chat", icon: Trash2 },
          ];

          return (
            <div
              key={thread.id}
              className="group relative"
              data-thread-menu-boundary="true"
              data-thread-id={thread.id}
            >
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
                  items={menuItems}
                  onClose={() => setOpenMenuThreadId(null)}
                  onItemClick={(label) => {
                    if (label === readToggleLabel) {
                      if (hasUnreadMessages) {
                        void markConversationReadMutation.mutateAsync({
                          conversationId: thread.id,
                          lastSeq: thread.lastMessageSeq,
                        });
                      } else {
                        void markConversationUnreadMutation.mutateAsync(thread.id);
                      }
                    }
                    if (label === muteLabel) {
                      if (muted) {
                        void setConversationMuteMutation.mutateAsync({
                          conversationId: thread.id,
                          mutedUntil: null,
                        });
                      } else {
                        onOpenMuteModal?.(thread.id);
                      }
                    }
                    if (label === "Block") {
                      onOpenConfirmation?.("block", thread.id);
                    }
                    if (label === "Archive chat") {
                      void archiveConversationMutation.mutateAsync(thread.id)
                        .then(() => {
                          if (thread.id === activeThreadId) {
                            router.push("/messages");
                          }
                        })
                        .catch(() => undefined);
                    }
                    if (label === "Delete chat") {
                      onOpenConfirmation?.("delete", thread.id);
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
