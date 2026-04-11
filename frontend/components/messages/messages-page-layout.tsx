"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { MessagesConversationActionModals } from "@/components/messages/messages-conversation-action-modals";
import { MessagesEmptyState } from "@/components/messages/messages-empty-state";
import { MessagesNewMessageModal } from "@/components/messages/messages-new-message-modal";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

export function MessagesPageLayout() {
  const {
    isNewMessageModalOpen,
    closeNewMessageModal,
    openConfirmation,
    openMuteModal,
    openNewMessageModal,
    resetThreadPanels,
    setActiveThreadId,
  } = useChatUiStore(useShallow((state) => ({
    isNewMessageModalOpen: state.isNewMessageModalOpen,
    closeNewMessageModal: state.closeNewMessageModal,
    openConfirmation: state.openConfirmation,
    openMuteModal: state.openMuteModal,
    openNewMessageModal: state.openNewMessageModal,
    resetThreadPanels: state.resetThreadPanels,
    setActiveThreadId: state.setActiveThreadId,
  })));

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
