"use client";

import { useState } from "react";

import { type MessageThread } from "@/lib/messages-data";
import { MessagesAsidePanel } from "@/components/messages/messages-aside-panel";
import { MessagesConfirmationModal } from "@/components/messages/messages-confirmation-modal";
import { MessagesMediaSidebar } from "@/components/messages/messages-media-sidebar";
import { MessagesMuteModal } from "@/components/messages/messages-mute-modal";
import { MessagesNewMessageModal } from "@/components/messages/messages-new-message-modal";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";
import { MessagesThreadView } from "@/components/messages/messages-thread-view";
import { MessagesUserSidebar } from "@/components/messages/messages-user-sidebar";

type MessagesThreadLayoutProps = {
  thread: MessageThread;
};

type AsideView = "info" | "media" | "file";
type ConfirmationAction = "block" | "delete" | null;

export function MessagesThreadLayout({ thread }: MessagesThreadLayoutProps) {
  const [isInfoSidebarOpen, setIsInfoSidebarOpen] = useState(true);
  const [asideView, setAsideView] = useState<AsideView>("info");
  const [isMuteModalOpen, setIsMuteModalOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<ConfirmationAction>(null);
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);

  const aside =
    asideView === "info" ? (
      <MessagesAsidePanel key="info">
        <MessagesUserSidebar
          thread={thread}
          onOpenMuteModal={() => setIsMuteModalOpen(true)}
          onOpenMediaPanel={(tab) => {
            setAsideView(tab);
            setIsInfoSidebarOpen(true);
          }}
        />
      </MessagesAsidePanel>
    ) : (
      <MessagesAsidePanel key={asideView}>
        <MessagesMediaSidebar
          thread={thread}
          initialTab={asideView}
          onBack={() => {
            setAsideView("info");
            setIsInfoSidebarOpen(true);
          }}
        />
      </MessagesAsidePanel>
    );

  return (
    <>
      <MessagesShell
        sidebar={
          <MessagesSidebar
            activeThreadId={thread.id}
            onOpenMuteModal={() => setIsMuteModalOpen(true)}
            onOpenConfirmation={(action) => setConfirmationAction(action)}
            onOpenNewMessageModal={() => setIsNewMessageModalOpen(true)}
          />
        }
        content={
          <MessagesThreadView
            thread={thread}
            isInfoSidebarOpen={isInfoSidebarOpen}
            onToggleInfoSidebar={() => {
              setIsInfoSidebarOpen((value) => {
                const next = !value;
                if (next) {
                  setAsideView("info");
                }
                return next;
              });
            }}
          />
        }
        aside={aside}
        asideVisible={isInfoSidebarOpen}
      />
      <MessagesMuteModal isOpen={isMuteModalOpen} onClose={() => setIsMuteModalOpen(false)} />
      <MessagesNewMessageModal
        isOpen={isNewMessageModalOpen}
        onClose={() => setIsNewMessageModalOpen(false)}
      />
      <MessagesConfirmationModal
        isOpen={confirmationAction === "block"}
        title="Block conversation"
        description="You won&apos;t receive new messages or calls from this conversation unless you unblock it later."
        confirmLabel="Block"
        onClose={() => setConfirmationAction(null)}
      />
      <MessagesConfirmationModal
        isOpen={confirmationAction === "delete"}
        title="Delete chat"
        description="This will remove the chat from your list. You can only restore it if it appears again from a new message."
        confirmLabel="Delete"
        onClose={() => setConfirmationAction(null)}
      />
    </>
  );
}
