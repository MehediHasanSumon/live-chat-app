"use client";

import { useEffect } from "react";

import { MessagesEmptyState } from "@/components/messages/messages-empty-state";
import { MessagesNewMessageModal } from "@/components/messages/messages-new-message-modal";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

export function MessagesPageLayout() {
  const isNewMessageModalOpen = useChatUiStore((state) => state.isNewMessageModalOpen);
  const closeNewMessageModal = useChatUiStore((state) => state.closeNewMessageModal);
  const openNewMessageModal = useChatUiStore((state) => state.openNewMessageModal);
  const resetThreadPanels = useChatUiStore((state) => state.resetThreadPanels);
  const setActiveThreadId = useChatUiStore((state) => state.setActiveThreadId);

  useEffect(() => {
    setActiveThreadId(null);
    resetThreadPanels();
  }, [resetThreadPanels, setActiveThreadId]);

  return (
    <>
      <MessagesShell
        sidebar={<MessagesSidebar onOpenNewMessageModal={openNewMessageModal} />}
        content={<MessagesEmptyState />}
      />
      <MessagesNewMessageModal
        isOpen={isNewMessageModalOpen}
        onClose={closeNewMessageModal}
      />
    </>
  );
}
