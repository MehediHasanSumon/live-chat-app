"use client";

import { Bell, FileText, Image, Lock } from "lucide-react";

import { type MessageThread } from "@/lib/messages-data";
import { MessagesAccordionSection } from "@/components/messages/messages-accordion-section";
import { MessageAvatar } from "@/components/messages/message-avatar";
import { MessagesEncryptionBadge } from "@/components/messages/messages-encryption-badge";
import { MessagesListRow } from "@/components/messages/messages-list-row";
import { MessagesQuickActions } from "@/components/messages/messages-quick-actions";

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

export function MessagesUserSidebar({ thread }: MessagesUserSidebarProps) {
  return (
    <aside className="surface hidden border-l border-[var(--line)] bg-[#fbfcff] lg:block">
      <div className="h-[calc(100vh-2rem)] overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center text-center">
          <MessageAvatar name={thread.name} online={thread.online} sizeClass="h-20 w-20" textClass="text-2xl" />

          <h2 className="mt-4 text-lg font-semibold tracking-tight">{thread.name}</h2>
          <div className="mt-3">
            <MessagesEncryptionBadge />
          </div>

          <MessagesQuickActions />
        </div>

        <div className="mt-6 space-y-5">
          <MessagesAccordionSection title="Media & files">
            {mediaItems.map((item) => (
              <MessagesListRow key={item.label} label={item.label} icon={item.icon} />
            ))}
          </MessagesAccordionSection>

          <MessagesAccordionSection title="Privacy & support">
            {privacyItems.map((item) => (
              <MessagesListRow key={item.label} label={item.label} icon={item.icon} />
            ))}
          </MessagesAccordionSection>
        </div>
      </div>
    </aside>
  );
}
