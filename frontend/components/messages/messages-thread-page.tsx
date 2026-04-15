"use client";

import { useShallow } from "zustand/react/shallow";

import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar, type SidebarListView } from "@/components/messages/messages-sidebar";
import { MessagesThreadLayout } from "@/components/messages/messages-thread-layout";
import { BoneyardSkeleton, PanelSkeleton } from "@/components/ui/boneyard-loading";
import { useConversationQuery } from "@/lib/hooks/use-conversation-query";
import { toConversationThread } from "@/lib/messages-data";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

type MessagesThreadPageProps = {
  threadId: string;
  sidebarView?: SidebarListView;
};

export function MessagesThreadPage({ threadId, sidebarView = "messages" }: MessagesThreadPageProps) {
  const {
    openConfirmation,
    openMuteModal,
    openNewMessageModal,
  } = useChatUiStore(useShallow((state) => ({
    openConfirmation: state.openConfirmation,
    openMuteModal: state.openMuteModal,
    openNewMessageModal: state.openNewMessageModal,
  })));
  const { data: conversation, isLoading, isError, isFetching } = useConversationQuery(threadId);

  if (isLoading) {
      return (
        <MessagesShell
        sidebar={
          <MessagesSidebar
            activeThreadId={threadId}
            sidebarView={sidebarView}
            onOpenMuteModal={openMuteModal}
            onOpenConfirmation={openConfirmation}
            onOpenNewMessageModal={openNewMessageModal}
          />
        }
        content={
          <section className="h-full w-full px-6">
            <div className="flex h-full w-full items-center justify-center">
              <BoneyardSkeleton name="conversation-thread-page" loading={isLoading} fallback={<PanelSkeleton lines={6} />}>
                <PanelSkeleton lines={6} />
              </BoneyardSkeleton>
            </div>
          </section>
        }
      />
    );
  }

  if (!conversation && (isLoading || isFetching)) {
    return (
      <MessagesShell
        sidebar={
          <MessagesSidebar
            activeThreadId={threadId}
            sidebarView={sidebarView}
            onOpenMuteModal={openMuteModal}
            onOpenConfirmation={openConfirmation}
            onOpenNewMessageModal={openNewMessageModal}
          />
        }
        content={
          <section className="h-full w-full px-6">
            <div className="flex h-full w-full items-center justify-center">
              <BoneyardSkeleton name="conversation-thread-refetch" loading={isLoading || isFetching} fallback={<PanelSkeleton lines={6} />}>
                <PanelSkeleton lines={6} />
              </BoneyardSkeleton>
            </div>
          </section>
        }
      />
    );
  }

  if (isError && !conversation) {
      return (
        <MessagesShell
        sidebar={
          <MessagesSidebar
            activeThreadId={threadId}
            sidebarView={sidebarView}
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
    );
  }

  if (!conversation) {
    return null;
  }

  return <MessagesThreadLayout thread={toConversationThread(conversation)} sidebarView={sidebarView} />;
}
