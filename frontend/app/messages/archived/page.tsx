"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ArchiveRestore } from "lucide-react";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { Button } from "@/components/ui/button";
import { useUnarchiveConversationMutation } from "@/lib/hooks/use-conversation-actions";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { toConversationThread } from "@/lib/messages-data";

export default function ArchivedChatsPage() {
  const { data: conversations = [], isLoading } = useConversationsQuery(true);
  const unarchiveMutation = useUnarchiveConversationMutation();

  const archivedThreads = useMemo(
    () =>
      conversations
        .filter((conversation) => Boolean(conversation.membership?.archived_at))
        .map((conversation) => toConversationThread(conversation)),
    [conversations],
  );

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto w-full max-w-4xl rounded-[1.5rem] px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-[#2d3150]">Archived chats</p>
            <p className="text-sm text-[var(--muted)]">Hidden conversations stay here until you open or unarchive them.</p>
          </div>
          <Link
            href="/messages"
            className="rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--foreground)]"
          >
            Back to messages
          </Link>
        </div>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
              Loading archived chats...
            </div>
          ) : null}

          {!isLoading && archivedThreads.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
              No archived chats right now.
            </div>
          ) : null}

          {archivedThreads.map((thread) => (
            <div
              key={thread.id}
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <MessageAvatar
                    name={thread.name}
                    imageUrl={thread.avatarUrl}
                    online={false}
                    sizeClass="h-11 w-11"
                    textClass="text-sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{thread.name}</p>
                    <p className="mt-1 truncate text-sm text-[var(--muted)]">{thread.lastMessage}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    className="gap-2"
                    disabled={unarchiveMutation.isPending}
                    onClick={() => {
                      void unarchiveMutation.mutateAsync(thread.id);
                    }}
                  >
                    <ArchiveRestore className="h-4 w-4" />
                    Unarchive
                  </Button>
                  <Link
                    href={`/messages/t/${thread.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                  >
                    Open chat
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
