"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { MessagesConversationActionModals } from "@/components/messages/messages-conversation-action-modals";
import { MessagesEmptyState } from "@/components/messages/messages-empty-state";
import { MessagesNewMessageModal } from "@/components/messages/messages-new-message-modal";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar, type SidebarListView } from "@/components/messages/messages-sidebar";
import { MessagesThreadLayout } from "@/components/messages/messages-thread-layout";
import { BoneyardSkeleton, PanelSkeleton } from "@/components/ui/boneyard-loading";
import { useConversationQuery } from "@/lib/hooks/use-conversation-query";
import { toConversationThread } from "@/lib/messages-data";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

type MessagesPageLayoutProps = {
  sidebarView?: SidebarListView;
  selectedThreadId?: string | null;
};

export function MessagesPageLayout({ sidebarView = "messages", selectedThreadId = null }: MessagesPageLayoutProps) {
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
  const {
    data: selectedConversation,
    isLoading: isSelectedConversationLoading,
    isError: isSelectedConversationError,
  } = useConversationQuery(selectedThreadId ?? "");

  useEffect(() => {
    if (!selectedThreadId) {
      setActiveThreadId(null);
      resetThreadPanels();
    }
  }, [resetThreadPanels, selectedThreadId, setActiveThreadId]);

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

  if (selectedThreadId) {
    if (isSelectedConversationLoading) {
      return (
        <>
          <MessagesShell
            sidebar={
              <MessagesSidebar
                sidebarView={sidebarView}
                activeThreadId={selectedThreadId}
                onOpenMuteModal={openMuteModal}
                onOpenConfirmation={openConfirmation}
                onOpenNewMessageModal={openNewMessageModal}
              />
            }
            content={
              <section className="h-full w-full px-6">
                <div className="flex h-full w-full items-center justify-center">
                  <BoneyardSkeleton name="selected-conversation-panel" loading={isSelectedConversationLoading} fallback={<PanelSkeleton lines={6} />}>
                    <PanelSkeleton lines={6} />
                  </BoneyardSkeleton>
                </div>
              </section>
            }
          />
          <MessagesNewMessageModal
            isOpen={isNewMessageModalOpen}
            onClose={closeNewMessageModal}
          />
          <MessagesConversationActionModals />
        </>
      );
    }

    if (isSelectedConversationError || !selectedConversation) {
      return (
        <>
          <MessagesShell
            sidebar={
              <MessagesSidebar
                sidebarView={sidebarView}
                activeThreadId={selectedThreadId}
                onOpenMuteModal={openMuteModal}
                onOpenConfirmation={openConfirmation}
                onOpenNewMessageModal={openNewMessageModal}
              />
            }
            content={
              <section className="h-full w-full px-6">
                <div className="flex h-full w-full items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-2xl font-semibold tracking-tight">Conversation unavailable</h1>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                      We could not load this conversation. Try another one from the sidebar.
                    </p>
                  </div>
                </div>
              </section>
            }
          />
          <MessagesNewMessageModal
            isOpen={isNewMessageModalOpen}
            onClose={closeNewMessageModal}
          />
          <MessagesConversationActionModals />
        </>
      );
    }

    return <MessagesThreadLayout thread={toConversationThread(selectedConversation)} sidebarView={sidebarView} />;
  }

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
