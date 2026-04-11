"use client";

import Link from "next/link";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { Button } from "@/components/ui/button";
import { useUnblockUserMutation } from "@/lib/hooks/use-conversation-actions";
import { useBlockedUsersQuery } from "@/lib/hooks/use-blocked-users-query";

export default function BlockedAccountsPage() {
  const { data: blockedUsers = [], isLoading } = useBlockedUsersQuery(true);
  const unblockMutation = useUnblockUserMutation();

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto w-full max-w-4xl rounded-[1.5rem] px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-[#2d3150]">Blocked accounts</p>
            <p className="text-sm text-[var(--muted)]">People you blocked will appear here until you unblock them.</p>
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
              Loading blocked accounts...
            </div>
          ) : null}

          {!isLoading && blockedUsers.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
              No blocked accounts right now.
            </div>
          ) : null}

          {blockedUsers.map((entry) => {
            const blockedUser = entry.blocked_user;

            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <MessageAvatar
                      name={blockedUser?.name ?? `User #${entry.blocked_user_id}`}
                      online={false}
                      sizeClass="h-11 w-11"
                      textClass="text-sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {blockedUser?.name ?? `User #${entry.blocked_user_id}`}
                      </p>
                      <p className="mt-1 truncate text-sm text-[var(--muted)]">
                        {blockedUser?.username ? `@${blockedUser.username}` : `User ID ${entry.blocked_user_id}`}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    disabled={unblockMutation.isPending}
                    onClick={() => {
                      void unblockMutation.mutateAsync(entry.blocked_user_id);
                    }}
                  >
                    Unblock
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
