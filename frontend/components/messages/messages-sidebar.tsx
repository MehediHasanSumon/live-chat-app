"use client";

import { useEffect, useRef, useState } from "react";

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

import { messageThreads } from "@/lib/messages-data";
import { MessagesFilterTabs } from "@/components/messages/messages-filter-tabs";
import { MessagesSearchBar } from "@/components/messages/messages-search-bar";
import { MessagesSidebarHeader } from "@/components/messages/messages-sidebar-header";
import { MessagesThreadMenu } from "@/components/messages/messages-thread-menu";
import { MessageThreadItem } from "@/components/messages/message-thread-item";

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
      <MessagesSidebarHeader
        isMenuOpen={isSidebarMenuOpen}
        onToggleMenu={() => {
          setIsSidebarMenuOpen((value) => !value);
          setOpenMenuThreadId(null);
        }}
        menuItems={sidebarMenuItems}
        onCloseMenu={() => setIsSidebarMenuOpen(false)}
      />

      <MessagesSearchBar />

      <MessagesFilterTabs
        filters={filters}
        activeFilter={activeFilter}
        onChange={(filter) => setActiveFilter(filter as (typeof filters)[number])}
      />

      <div className="mt-4 space-y-2">
        {messageThreads.map((thread) => {
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
                <MessagesThreadMenu items={threadMenuItems} onClose={() => setOpenMenuThreadId(null)} />
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
