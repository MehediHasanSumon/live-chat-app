"use client";

import { useState } from "react";

import { MessagesEmptyState } from "@/components/messages/messages-empty-state";
import { MessagesNewMessageModal } from "@/components/messages/messages-new-message-modal";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";

export function MessagesPageLayout() {
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);

  return (
    <>
      <MessagesShell
        sidebar={<MessagesSidebar onOpenNewMessageModal={() => setIsNewMessageModalOpen(true)} />}
        content={<MessagesEmptyState />}
      />
      <MessagesNewMessageModal
        isOpen={isNewMessageModalOpen}
        onClose={() => setIsNewMessageModalOpen(false)}
      />
    </>
  );
}
