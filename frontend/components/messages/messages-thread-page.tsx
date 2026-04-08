"use client";

import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";
import { MessagesThreadLayout } from "@/components/messages/messages-thread-layout";
import { useConversationQuery } from "@/lib/hooks/use-conversation-query";
import { toConversationThread } from "@/lib/messages-data";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

type MessagesThreadPageProps = {
  threadId: string;
};

export function MessagesThreadPage({ threadId }: MessagesThreadPageProps) {
  const openNewMessageModal = useChatUiStore((state) => state.openNewMessageModal);
  const { data: conversation, isLoading, isError } = useConversationQuery(threadId);

  if (isLoading) {
    return (
      <MessagesShell
        sidebar={<MessagesSidebar activeThreadId={threadId} onOpenNewMessageModal={openNewMessageModal} />}
        content={
          <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />
            <p className="mt-4 text-sm text-[var(--muted)]">Loading conversation...</p>
          </section>
        }
      />
    );
  }

  if (isError || !conversation) {
    return (
      <MessagesShell
        sidebar={<MessagesSidebar activeThreadId={threadId} onOpenNewMessageModal={openNewMessageModal} />}
        content={
          <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Conversation unavailable</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              We could not load this conversation. Try another one from the sidebar.
            </p>
          </section>
        }
      />
    );
  }

  return <MessagesThreadLayout thread={toConversationThread(conversation)} />;
}
