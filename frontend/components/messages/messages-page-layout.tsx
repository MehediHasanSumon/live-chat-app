"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { MessagesConversationActionModals } from "@/components/messages/messages-conversation-action-modals";
import { MessagesEmptyState } from "@/components/messages/messages-empty-state";
import { MessagesNewMessageModal } from "@/components/messages/messages-new-message-modal";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar, type SidebarListView } from "@/components/messages/messages-sidebar";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

type MessagesPageLayoutProps = {
  sidebarView?: SidebarListView;
};

export function MessagesPageLayout({ sidebarView = "messages" }: MessagesPageLayoutProps) {
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

  const emptyStateTitle =
    sidebarView === "requests"
      ? "Message requests"
      : sidebarView === "archived"
        ? "Archived chats"
        : sidebarView === "blocked"
          ? "Blocked accounts"
          : "Select a conversation";
  const emptyStateDescription =
    sidebarView === "requests"
      ? "Review pending requests from the sidebar and accept or reject them here."
      : sidebarView === "archived"
        ? "Open an archived chat from the sidebar whenever you want to revisit it."
        : sidebarView === "blocked"
          ? "Manage blocked people from the sidebar and unblock them whenever needed."
          : "Choose a conversation from the sidebar to open its details. The real message timeline lands in the next backend phase.";

  return (
    <>
      <MessagesShell
        sidebar={
          <MessagesSidebar
            sidebarView={sidebarView}
            onOpenMuteModal={openMuteModal}
            onOpenConfirmation={openConfirmation}
            onOpenNewMessageModal={openNewMessageModal}
          />
        }
        content={<MessagesEmptyState title={emptyStateTitle} description={emptyStateDescription} />}
      />
      <MessagesNewMessageModal
        isOpen={isNewMessageModalOpen}
        onClose={closeNewMessageModal}
      />
      <MessagesConversationActionModals />
    </>
  );
}
