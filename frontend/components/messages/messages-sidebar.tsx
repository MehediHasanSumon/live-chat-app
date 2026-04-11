"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Archive,
  Bell,
  CircleSlash,
  CheckCheck,
  Inbox,
  MessageCircleOff,
  Phone,
  ShieldBan,
  Trash2,
  Video,
} from "lucide-react";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { MessagesFilterTabs } from "@/components/messages/messages-filter-tabs";
import { MessagesSearchBar } from "@/components/messages/messages-search-bar";
import { MessagesSidebarHeader } from "@/components/messages/messages-sidebar-header";
import { MessagesThreadMenu } from "@/components/messages/messages-thread-menu";
import { MessageThreadItem } from "@/components/messages/message-thread-item";
import {
  useArchiveConversationMutation,
  useMarkConversationUnreadMutation,
  useSetConversationMuteMutation,
  useUnblockUserMutation,
} from "@/lib/hooks/use-conversation-actions";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { useMarkConversationReadMutation } from "@/lib/hooks/use-mark-read-mutation";
import { useConversationPresenceMap } from "@/lib/hooks/use-user-presence-query";
import { useAcceptMessageRequestMutation, useRejectMessageRequestMutation } from "@/lib/hooks/use-message-request-mutations";
import { useMessageRequestsQuery } from "@/lib/hooks/use-message-requests-query";
import { applyPresenceToThread, toConversationThread } from "@/lib/messages-data";
import { useBlockedUsersQuery } from "@/lib/hooks/use-blocked-users-query";

const filters = ["All", "Unread", "Groups"] as const;

export type SidebarListView = "messages" | "requests" | "archived" | "blocked";

type MessagesSidebarProps = {
  activeThreadId?: string;
  sidebarView?: SidebarListView;
  onOpenMuteModal?: (threadId?: string | null) => void;
  onOpenConfirmation?: (action: "block" | "delete", threadId?: string | null) => void;
  onOpenNewMessageModal?: () => void;
};

function isThreadMuted(mutedUntil: string | null | undefined) {
  if (!mutedUntil) {
    return false;
  }

  const mutedDate = new Date(mutedUntil);

  return !Number.isNaN(mutedDate.getTime()) && mutedDate.getTime() > Date.now();
}

export function MessagesSidebar({
  activeThreadId,
  sidebarView = "messages",
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
  const shouldLoadConversations = Boolean(activeThreadId) || sidebarView === "messages" || sidebarView === "archived";
  const { data: conversations = [], isLoading, isError } = useConversationsQuery(shouldLoadConversations);
  const { data: requests = [], isLoading: isRequestsLoading, isError: isRequestsError } = useMessageRequestsQuery(sidebarView === "requests");
  const { data: blockedUsers = [], isLoading: isBlockedLoading, isError: isBlockedError } = useBlockedUsersQuery(sidebarView === "blocked");
  const archiveConversationMutation = useArchiveConversationMutation();
  const markConversationReadMutation = useMarkConversationReadMutation();
  const markConversationUnreadMutation = useMarkConversationUnreadMutation();
  const setConversationMuteMutation = useSetConversationMuteMutation();
  const acceptRequestMutation = useAcceptMessageRequestMutation();
  const rejectRequestMutation = useRejectMessageRequestMutation();
  const unblockUserMutation = useUnblockUserMutation();

  const sidebarTitle =
    sidebarView === "requests"
      ? "Message requests"
      : sidebarView === "archived"
        ? "Archived chats"
        : sidebarView === "blocked"
          ? "Blocked accounts"
          : "Messages";
  const searchPlaceholder =
    sidebarView === "requests"
      ? "Search requests"
      : sidebarView === "archived"
        ? "Search archived chats"
        : sidebarView === "blocked"
          ? "Search blocked accounts"
          : "Search conversations";

  const navigateToSidebarView = useCallback((view: SidebarListView) => {
    if (view === "messages") {
      router.push("/messages");
      return;
    }

    if (view === "requests") {
      router.push("/messages/message-requests");
      return;
    }

    if (view === "archived") {
      router.push("/messages/archived-chats");
      return;
    }

    router.push("/messages/blocked-account");
  }, [router]);

  const sidebarMenuItems = useMemo(
    () =>
      [
        sidebarView !== "messages"
          ? { label: "Messages", icon: Inbox, onClick: () => navigateToSidebarView("messages") }
          : null,
        { label: "Message requests", icon: Inbox, onClick: () => navigateToSidebarView("requests") },
        { label: "Archived chats", icon: Archive, onClick: () => navigateToSidebarView("archived") },
        { label: "Blocked accounts", icon: ShieldBan, onClick: () => navigateToSidebarView("blocked") },
      ].filter((item): item is NonNullable<typeof item> => item !== null),
    [navigateToSidebarView, sidebarView],
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
  const archivedThreads = useMemo(
    () => threadsWithPresence.filter((thread) => Boolean(thread.membership?.archived_at)),
    [threadsWithPresence],
  );
  const requestThreads = useMemo(
    () => requests.map((conversation) => toConversationThread(conversation)),
    [requests],
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

  const filteredArchivedThreads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return archivedThreads.filter((thread) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        thread.name.toLowerCase().includes(normalizedQuery) ||
        thread.handle.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [archivedThreads, searchQuery]);

  const filteredRequestThreads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return requestThreads.filter((thread) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        thread.name.toLowerCase().includes(normalizedQuery) ||
        thread.handle.toLowerCase().includes(normalizedQuery) ||
        thread.lastMessage.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [requestThreads, searchQuery]);

  const filteredBlockedUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return blockedUsers.filter((entry) => {
      const blockedUser = entry.blocked_user;
      const name = blockedUser?.name ?? `User #${entry.blocked_user_id}`;
      const username = blockedUser?.username ?? "";

      if (!normalizedQuery) {
        return true;
      }

      return (
        name.toLowerCase().includes(normalizedQuery) ||
        username.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [blockedUsers, searchQuery]);

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

  const handleSelectThread = useCallback(() => {
    setOpenMenuThreadId(null);
    setIsSidebarMenuOpen(false);
  }, []);

  const handleToggleSidebarMenu = useCallback(() => {
    setIsSidebarMenuOpen((value) => !value);
    setOpenMenuThreadId(null);
  }, []);

  const handleCloseSidebarMenu = useCallback(() => {
    setIsSidebarMenuOpen(false);
  }, []);

  const handleOpenThreadMenu = useCallback((threadId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsSidebarMenuOpen(false);
    setOpenMenuThreadId((value) => (value === threadId ? null : threadId));
  }, []);

  const handleFilterChange = useCallback((filter: string) => {
    setActiveFilter(filter as (typeof filters)[number]);
  }, []);

  return (
    <aside ref={sidebarRef} className="surface h-full w-full border-r border-[var(--line)] px-4 py-4 sm:px-5">
      <MessagesSidebarHeader
        title={sidebarTitle}
        isMenuOpen={isSidebarMenuOpen}
        onToggleMenu={handleToggleSidebarMenu}
        menuItems={sidebarMenuItems}
        onCloseMenu={handleCloseSidebarMenu}
        onComposeClick={onOpenNewMessageModal}
      />

      <MessagesSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={searchPlaceholder}
      />

      {sidebarView === "messages" ? (
        <MessagesFilterTabs
          filters={filters}
          activeFilter={activeFilter}
          onChange={handleFilterChange}
        />
      ) : null}

      <div className="mt-4 space-y-2">
        {(sidebarView === "messages" || sidebarView === "archived") && isLoading
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

        {sidebarView === "requests" && isRequestsLoading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            Loading requests...
          </div>
        ) : null}

        {sidebarView === "blocked" && isBlockedLoading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            Loading blocked accounts...
          </div>
        ) : null}

        {(sidebarView === "messages" || sidebarView === "archived") && !isLoading && isError ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            We could not load conversations right now.
          </div>
        ) : null}

        {sidebarView === "requests" && !isRequestsLoading && isRequestsError ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            We could not load message requests right now.
          </div>
        ) : null}

        {sidebarView === "blocked" && !isBlockedLoading && isBlockedError ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            We could not load blocked accounts right now.
          </div>
        ) : null}

        {sidebarView === "messages" && !isLoading && !isError && filteredThreads.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            {visibleThreads.length === 0
              ? "No conversations yet. Start one from the compose button when user search is ready."
              : "No conversations match this filter."}
          </div>
        ) : null}

        {sidebarView === "archived" && !isLoading && !isError && filteredArchivedThreads.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            {archivedThreads.length === 0 ? "No archived chats yet." : "No archived chats match this search."}
          </div>
        ) : null}

        {sidebarView === "requests" && !isRequestsLoading && !isRequestsError && filteredRequestThreads.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            {requestThreads.length === 0 ? "No pending message requests." : "No message requests match this search."}
          </div>
        ) : null}

        {sidebarView === "blocked" && !isBlockedLoading && !isBlockedError && filteredBlockedUsers.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            {blockedUsers.length === 0 ? "No blocked accounts yet." : "No blocked accounts match this search."}
          </div>
        ) : null}

        {sidebarView === "messages"
          ? filteredThreads.map((thread) => {
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
                    onSelect={handleSelectThread}
                    onOpenMenu={handleOpenThreadMenu}
                    showMenuButton
                  />

                  {isMenuOpen ? (
                    <MessagesThreadMenu
                      items={menuItems}
                      onClose={() => setOpenMenuThreadId(null)}
                      onItemClick={(label) => {
                        if (label === readToggleLabel) {
                          setOpenMenuThreadId(null);
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
                          setOpenMenuThreadId(null);
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
                          setOpenMenuThreadId(null);
                          onOpenConfirmation?.("block", thread.id);
                        }

                        if (label === "Archive chat") {
                          setOpenMenuThreadId(null);
                          void archiveConversationMutation.mutateAsync(thread.id)
                            .then(() => {
                              if (thread.id === activeThreadId) {
                                router.push("/messages");
                              }
                            })
                            .catch(() => undefined);
                        }

                        if (label === "Delete chat") {
                          setOpenMenuThreadId(null);
                          onOpenConfirmation?.("delete", thread.id);
                        }
                      }}
                    />
                  ) : null}
                </div>
              );
            })
          : null}

        {sidebarView === "archived"
          ? filteredArchivedThreads.map((thread) => (
              <div key={thread.id} className="group relative">
                <MessageThreadItem
                  thread={thread}
                  isActive={false}
                  isMenuOpen={false}
                  onSelect={handleSelectThread}
                  onOpenMenu={handleOpenThreadMenu}
                  showMenuButton={false}
                />
              </div>
            ))
          : null}

        {sidebarView === "requests"
          ? filteredRequestThreads.map((thread) => (
              <div
                key={thread.id}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-3"
              >
                <div className="flex items-start gap-3">
                  <MessageAvatar name={thread.name} online={false} imageUrl={thread.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{thread.name}</p>
                      <span className="shrink-0 text-xs text-[var(--muted)]">{thread.time}</span>
                    </div>
                    <p className="mt-1.5 truncate text-sm text-[var(--muted)]">{thread.lastMessage}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={rejectRequestMutation.isPending}
                        onClick={() => {
                          void rejectRequestMutation.mutateAsync(thread.numericId);
                        }}
                        className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:border-[rgba(96,91,255,0.22)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={acceptRequestMutation.isPending}
                        onClick={() => {
                          void acceptRequestMutation.mutateAsync(thread.numericId);
                        }}
                        className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          : null}

        {sidebarView === "blocked"
          ? filteredBlockedUsers.map((entry) => {
              const blockedUser = entry.blocked_user;
              const name = blockedUser?.name ?? `User #${entry.blocked_user_id}`;
              const handle = blockedUser?.username ? `@${blockedUser.username}` : `User ID ${entry.blocked_user_id}`;

              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[var(--line)] bg-white px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <MessageAvatar name={name} online={false} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{name}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">{handle}</p>
                        </div>
                        <CircleSlash className="h-4 w-4 shrink-0 text-rose-400" />
                      </div>
                      <p className="mt-2 text-xs font-medium text-rose-500">You can&apos;t Message</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={unblockUserMutation.isPending}
                      onClick={() => {
                        void unblockUserMutation.mutateAsync(entry.blocked_user_id);
                      }}
                      className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Unblock
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/messages")}
                      className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:border-[rgba(96,91,255,0.22)] hover:text-[var(--accent)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })
          : null}
      </div>
    </aside>
  );
}
