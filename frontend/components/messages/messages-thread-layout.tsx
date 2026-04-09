"use client";

import { useEffect, useState } from "react";

import { type MessageThread } from "@/lib/messages-data";
import { MessagesAsidePanel } from "@/components/messages/messages-aside-panel";
import { MessagesConfirmationModal } from "@/components/messages/messages-confirmation-modal";
import { MessagesImageViewer, type MessagesImageViewerItem } from "@/components/messages/messages-image-viewer";
import { MessagesMediaSidebar } from "@/components/messages/messages-media-sidebar";
import { MessagesMuteModal } from "@/components/messages/messages-mute-modal";
import { MessagesNewMessageModal } from "@/components/messages/messages-new-message-modal";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";
import { MessagesThreadView } from "@/components/messages/messages-thread-view";
import { MessagesUserSidebar } from "@/components/messages/messages-user-sidebar";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

type MessagesThreadLayoutProps = {
  thread: MessageThread;
};

export function MessagesThreadLayout({ thread }: MessagesThreadLayoutProps) {
  const [viewerImages, setViewerImages] = useState<MessagesImageViewerItem[]>([]);
  const [viewerThreadId, setViewerThreadId] = useState<string | null>(null);
  const [activeViewerImageId, setActiveViewerImageId] = useState<string | null>(null);
  const activeThreadId = useChatUiStore((state) => state.activeThreadId);
  const asideView = useChatUiStore((state) => state.asideView);
  const confirmationAction = useChatUiStore((state) => state.confirmationAction);
  const isInfoSidebarOpen = useChatUiStore((state) => state.isInfoSidebarOpen);
  const isMuteModalOpen = useChatUiStore((state) => state.isMuteModalOpen);
  const isNewMessageModalOpen = useChatUiStore((state) => state.isNewMessageModalOpen);
  const closeConfirmation = useChatUiStore((state) => state.closeConfirmation);
  const closeMuteModal = useChatUiStore((state) => state.closeMuteModal);
  const closeNewMessageModal = useChatUiStore((state) => state.closeNewMessageModal);
  const openAsideView = useChatUiStore((state) => state.openAsideView);
  const openConfirmation = useChatUiStore((state) => state.openConfirmation);
  const openMuteModal = useChatUiStore((state) => state.openMuteModal);
  const openNewMessageModal = useChatUiStore((state) => state.openNewMessageModal);
  const resetThreadPanels = useChatUiStore((state) => state.resetThreadPanels);
  const setActiveThreadId = useChatUiStore((state) => state.setActiveThreadId);
  const toggleInfoSidebar = useChatUiStore((state) => state.toggleInfoSidebar);

  useEffect(() => {
    setActiveThreadId(thread.id);
    resetThreadPanels();
  }, [resetThreadPanels, setActiveThreadId, thread.id]);

  const openImageViewer = (images: MessagesImageViewerItem[], activeImageId: string) => {
    setViewerThreadId(thread.id);
    setViewerImages(images);
    setActiveViewerImageId(activeImageId);
  };

  const aside =
    asideView === "info" ? (
      <MessagesAsidePanel key="info">
        <MessagesUserSidebar
          thread={thread}
          onOpenMuteModal={openMuteModal}
          onOpenMediaPanel={openAsideView}
        />
      </MessagesAsidePanel>
    ) : (
      <MessagesAsidePanel key={asideView}>
        <MessagesMediaSidebar
          thread={thread}
          initialTab={asideView}
          onBack={() => openAsideView("info")}
          onOpenImageViewer={openImageViewer}
        />
      </MessagesAsidePanel>
    );

  return (
    <>
      <MessagesShell
        sidebar={
          <MessagesSidebar
            activeThreadId={activeThreadId ?? thread.id}
            onOpenMuteModal={openMuteModal}
            onOpenConfirmation={openConfirmation}
            onOpenNewMessageModal={openNewMessageModal}
          />
        }
        content={
          <MessagesThreadView
            thread={thread}
            isInfoSidebarOpen={isInfoSidebarOpen}
            onToggleInfoSidebar={toggleInfoSidebar}
            onOpenImageViewer={openImageViewer}
          />
        }
        aside={aside}
        asideVisible={isInfoSidebarOpen}
      />
      <MessagesImageViewer
        images={viewerThreadId === thread.id ? viewerImages : []}
        activeImageId={viewerThreadId === thread.id ? activeViewerImageId : null}
        onClose={() => {
          setActiveViewerImageId(null);
          setViewerThreadId(null);
        }}
        onSelectImage={setActiveViewerImageId}
      />
      <MessagesMuteModal isOpen={isMuteModalOpen} onClose={closeMuteModal} />
      <MessagesNewMessageModal
        isOpen={isNewMessageModalOpen}
        onClose={closeNewMessageModal}
      />
      <MessagesConfirmationModal
        isOpen={confirmationAction === "block"}
        title="Block conversation"
        description="You won&apos;t receive new messages or calls from this conversation unless you unblock it later."
        confirmLabel="Block"
        onClose={closeConfirmation}
      />
      <MessagesConfirmationModal
        isOpen={confirmationAction === "delete"}
        title="Delete chat"
        description="This will remove the chat from your list. You can only restore it if it appears again from a new message."
        confirmLabel="Delete"
        onClose={closeConfirmation}
      />
    </>
  );
}
