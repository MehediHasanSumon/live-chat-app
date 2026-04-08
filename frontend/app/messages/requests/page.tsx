"use client";

import Link from "next/link";

import { ProtectedRouteGuard } from "@/components/auth/protected-route-guard";
import { Button } from "@/components/ui/button";
import { useAcceptMessageRequestMutation, useRejectMessageRequestMutation } from "@/lib/hooks/use-message-request-mutations";
import { useMessageRequestsQuery } from "@/lib/hooks/use-message-requests-query";
import { toConversationThread } from "@/lib/messages-data";

export default function MessageRequestsPage() {
  const { data: requests = [], isLoading } = useMessageRequestsQuery(true);
  const acceptMutation = useAcceptMessageRequestMutation();
  const rejectMutation = useRejectMessageRequestMutation();

  return (
    <ProtectedRouteGuard>
      <main className="shell px-4 py-6 sm:px-6">
        <section className="glass-card mx-auto w-full max-w-4xl rounded-[1.5rem] px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-[#2d3150]">Message requests</p>
              <p className="text-sm text-[var(--muted)]">Review pending direct conversations before they become active chats.</p>
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
                Loading requests...
              </div>
            ) : null}

            {!isLoading && requests.length === 0 ? (
              <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
                No pending message requests.
              </div>
            ) : null}

            {requests.map((conversation) => {
              const thread = toConversationThread(conversation);

              return (
                <div key={conversation.id} className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{thread.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{thread.lastMessage}</p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        disabled={rejectMutation.isPending}
                        onClick={() => {
                          void rejectMutation.mutateAsync(conversation.id);
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        disabled={acceptMutation.isPending}
                        onClick={() => {
                          void acceptMutation.mutateAsync(conversation.id);
                        }}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </ProtectedRouteGuard>
  );
}
