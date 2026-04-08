"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Archive, Bell, Crown, FileText, Image, Lock, LogOut, Plus, ShieldBan, UserPlus } from "lucide-react";

import { type MessageThread } from "@/lib/messages-data";
import { useAddGroupMembersMutation, useChangeGroupRoleMutation, useLeaveGroupMutation, useRemoveGroupMemberMutation } from "@/lib/hooks/use-group-member-mutations";
import { useUserSearchQuery } from "@/lib/hooks/use-user-search-query";
import { MessagesAccordionSection } from "@/components/messages/messages-accordion-section";
import { MessageAvatar } from "@/components/messages/message-avatar";
import { MessagesEncryptionBadge } from "@/components/messages/messages-encryption-badge";
import { MessagesListRow } from "@/components/messages/messages-list-row";
import { MessagesQuickActions } from "@/components/messages/messages-quick-actions";

type MessagesUserSidebarProps = {
  thread: MessageThread;
  onOpenMediaPanel?: (tab: "media" | "file") => void;
  onOpenMuteModal?: () => void;
};

const mediaItems = [
  { label: "Media", icon: Image },
  { label: "Files", icon: FileText },
];

export function MessagesUserSidebar({
  thread,
  onOpenMediaPanel,
  onOpenMuteModal,
}: MessagesUserSidebarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const currentMembership = thread.membership ?? null;
  const canManageMembers = thread.isGroup && ["owner", "admin"].includes(currentMembership?.role ?? "");
  const { data: users = [] } = useUserSearchQuery(searchQuery, Boolean(canManageMembers));
  const addMembersMutation = useAddGroupMembersMutation(thread.id);
  const removeMemberMutation = useRemoveGroupMemberMutation(thread.id);
  const changeRoleMutation = useChangeGroupRoleMutation(thread.id);
  const leaveGroupMutation = useLeaveGroupMutation(thread.id);

  const visibleMembers = useMemo(
    () =>
      (thread.members ?? [])
        .filter((member) => member.user)
        .sort((left, right) => {
          const order = { owner: 0, admin: 1, member: 2 };
          return order[left.role] - order[right.role];
        }),
    [thread.members],
  );

  const privacyItems = [
    { label: "Mute notifications", icon: Bell, action: () => onOpenMuteModal?.() },
    { label: "Settings", icon: Lock, action: () => router.push("/settings") },
    { label: "Message requests", icon: ShieldBan, action: () => router.push("/messages/requests") },
    ...(thread.isGroup
      ? [{ label: "Leave Group", icon: LogOut, action: async () => {
          await leaveGroupMutation.mutateAsync();
          router.push("/messages");
        } }]
      : [{ label: "Blocked accounts", icon: ShieldBan }]),
    { label: "Verify end-to-end encryption", icon: Lock },
  ];

  return (
    <div className="surface h-full bg-[#fbfcff]">
      <div className="h-full overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center text-center">
          <MessageAvatar name={thread.name} online={thread.online} sizeClass="h-20 w-20" textClass="text-2xl" />

          <h2 className="mt-4 text-lg font-semibold tracking-tight">{thread.name}</h2>
          {thread.description ? <p className="mt-2 text-sm text-[var(--muted)]">{thread.description}</p> : null}
          <div className="mt-3">
            <MessagesEncryptionBadge />
          </div>

          <MessagesQuickActions onMuteClick={onOpenMuteModal} />
        </div>

        <div className="mt-6 space-y-5">
          <MessagesAccordionSection title="Media & files">
            {mediaItems.map((item) => (
              <MessagesListRow
                key={item.label}
                label={item.label}
                icon={item.icon}
                onClick={() => onOpenMediaPanel?.(item.label === "Media" ? "media" : "file")}
              />
            ))}
          </MessagesAccordionSection>

          {thread.isGroup ? (
            <MessagesAccordionSection title="Members">
              <div className="space-y-3">
                {visibleMembers.map((member) => (
                  <div key={member.id} className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3">
                    <div className="flex items-center gap-3">
                      <MessageAvatar
                        name={member.user?.name ?? `User #${member.user_id}`}
                        online={false}
                        sizeClass="h-10 w-10"
                        textClass="text-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                          {member.user?.name ?? `User #${member.user_id}`}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {member.role}
                          {member.membership_state !== "active" ? ` · ${member.membership_state}` : ""}
                        </p>
                      </div>
                      {member.role === "owner" ? <Crown className="h-4 w-4 text-amber-500" /> : null}
                    </div>

                    {canManageMembers && member.role !== "owner" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void changeRoleMutation.mutateAsync({
                              userId: member.user_id,
                              role: member.role === "admin" ? "member" : "admin",
                            });
                          }}
                          className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--foreground)]"
                        >
                          {member.role === "admin" ? "Make member" : "Make admin"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void removeMemberMutation.mutateAsync(member.user_id);
                          }}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}

                {canManageMembers ? (
                  <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                      <UserPlus className="h-4 w-4 text-[var(--accent)]" />
                      <span>Add members</span>
                    </div>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search users by name or username"
                      className="mt-3 w-full rounded-xl border border-[var(--line)] bg-[#fbfcff] px-3 py-2 text-sm outline-none"
                    />
                    <div className="mt-3 space-y-2">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center justify-between rounded-xl bg-[var(--accent-soft)]/50 px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-[var(--foreground)]">{user.name}</p>
                            <p className="text-xs text-[var(--muted)]">@{user.username}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void addMembersMutation.mutateAsync([user.id]);
                            }}
                            className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white"
                          >
                            <Plus className="mr-1 inline h-3 w-3" />
                            Add
                          </button>
                        </div>
                      ))}
                      {searchQuery.trim().length >= 2 && users.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">No users found for this search.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </MessagesAccordionSection>
          ) : null}

          <MessagesAccordionSection title="Privacy & support">
            {privacyItems.map((item) => (
              <MessagesListRow
                key={item.label}
                label={item.label}
                icon={item.icon}
                onClick={item.action}
              />
            ))}
            <MessagesListRow label="Admin ops" icon={Archive} onClick={() => router.push("/admin/ops")} />
          </MessagesAccordionSection>
        </div>
      </div>
    </div>
  );
}
