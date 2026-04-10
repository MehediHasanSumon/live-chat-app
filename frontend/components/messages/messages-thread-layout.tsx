"use client";

import { useEffect, useMemo, useState } from "react";

import { applyPresenceToThread, getDirectThreadPeer, type MessageThread } from "@/lib/messages-data";
import { MessagesAsidePanel } from "@/components/messages/messages-aside-panel";
import { MessagesConversationActionModals } from "@/components/messages/messages-conversation-action-modals";
import { MessagesImageViewer, type MessagesImageViewerItem } from "@/components/messages/messages-image-viewer";
import { MessagesMediaSidebar } from "@/components/messages/messages-media-sidebar";
import { MessagesNewMessageModal } from "@/components/messages/messages-new-message-modal";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";
import { MessagesThreadView } from "@/components/messages/messages-thread-view";
import { MessagesUserSidebar } from "@/components/messages/messages-user-sidebar";
import { useUserPresenceQuery } from "@/lib/hooks/use-user-presence-query";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

type MessagesThreadLayoutProps = {
  thread: MessageThread;
};

export function MessagesThreadLayout({ thread }: MessagesThreadLayoutProps) {
  const [viewerImages, setViewerImages] = useState<MessagesImageViewerItem[]>([]);
  const [viewerThreadId, setViewerThreadId] = useState<string | null>(null);
  const [activeViewerImageId, setActiveViewerImageId] = useState<string | null>(null);
  const directPeer = getDirectThreadPeer(thread);
  const { data: presence } = useUserPresenceQuery(directPeer?.user_id, !thread.isGroup && Boolean(directPeer?.user_id));
  const activeThreadId = useChatUiStore((state) => state.activeThreadId);
  const asideView = useChatUiStore((state) => state.asideView);
  const isInfoSidebarOpen = useChatUiStore((state) => state.isInfoSidebarOpen);
  const isNewMessageModalOpen = useChatUiStore((state) => state.isNewMessageModalOpen);
  const closeNewMessageModal = useChatUiStore((state) => state.closeNewMessageModal);
  const openAsideView = useChatUiStore((state) => state.openAsideView);
  const openConfirmation = useChatUiStore((state) => state.openConfirmation);
  const openMuteModal = useChatUiStore((state) => state.openMuteModal);
  const openNewMessageModal = useChatUiStore((state) => state.openNewMessageModal);
  const resetThreadPanels = useChatUiStore((state) => state.resetThreadPanels);
  const setActiveThreadId = useChatUiStore((state) => state.setActiveThreadId);
  const toggleInfoSidebar = useChatUiStore((state) => state.toggleInfoSidebar);
  const threadWithPresence = useMemo(
    () => applyPresenceToThread(thread, presence),
    [presence, thread],
  );

  useEffect(() => {
    setActiveThreadId(threadWithPresence.id);
    resetThreadPanels();
  }, [resetThreadPanels, setActiveThreadId, threadWithPresence.id]);

  const openImageViewer = (images: MessagesImageViewerItem[], activeImageId: string) => {
    setViewerThreadId(thread.id);
    setViewerImages(images);
    setActiveViewerImageId(activeImageId);
  };

  const aside =
    asideView === "info" ? (
      <MessagesAsidePanel key="info">
        <MessagesUserSidebar
          thread={threadWithPresence}
          onOpenMuteModal={openMuteModal}
          onOpenMediaPanel={openAsideView}
        />
      </MessagesAsidePanel>
    ) : (
      <MessagesAsidePanel key={asideView}>
        <MessagesMediaSidebar
          thread={threadWithPresence}
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
            thread={threadWithPresence}
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
      <MessagesNewMessageModal
        isOpen={isNewMessageModalOpen}
        onClose={closeNewMessageModal}
      />
      <MessagesConversationActionModals />
    </>
  );
}
