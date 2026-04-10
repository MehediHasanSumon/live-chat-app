"use client";

import { useEffect } from "react";

import { MessagesConversationActionModals } from "@/components/messages/messages-conversation-action-modals";
import { MessagesEmptyState } from "@/components/messages/messages-empty-state";
import { MessagesNewMessageModal } from "@/components/messages/messages-new-message-modal";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

export function MessagesPageLayout() {
  const isNewMessageModalOpen = useChatUiStore((state) => state.isNewMessageModalOpen);
  const closeNewMessageModal = useChatUiStore((state) => state.closeNewMessageModal);
  const openConfirmation = useChatUiStore((state) => state.openConfirmation);
  const openMuteModal = useChatUiStore((state) => state.openMuteModal);
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
        sidebar={
          <MessagesSidebar
            onOpenMuteModal={openMuteModal}
            onOpenConfirmation={openConfirmation}
            onOpenNewMessageModal={openNewMessageModal}
          />
        }
        content={<MessagesEmptyState />}
      />
      <MessagesNewMessageModal
        isOpen={isNewMessageModalOpen}
        onClose={closeNewMessageModal}
      />
      <MessagesConversationActionModals />
    </>
  );
}
