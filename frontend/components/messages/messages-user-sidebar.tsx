"use client";

import { memo, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Archive, Bell, Crown, FileText, Image, Lock, LogOut, Plus, ShieldBan } from "lucide-react";

import { openAudioCallWindow } from "@/lib/call-window";
import { getDirectCallTargetUserId } from "@/lib/calls-data";
import { formatPresenceLabel, type MessageThread } from "@/lib/messages-data";
import {
  useArchiveConversationMutation,
  useSetConversationMuteMutation,
  useUnarchiveConversationMutation,
} from "@/lib/hooks/use-conversation-actions";
import { useAddGroupMembersMutation, useChangeGroupRoleMutation, useLeaveGroupMutation, useRemoveGroupMemberMutation } from "@/lib/hooks/use-group-member-mutations";
import { useUserSearchQuery } from "@/lib/hooks/use-user-search-query";
import { MessagesAccordionSection } from "@/components/messages/messages-accordion-section";
import { MessageAvatar } from "@/components/messages/message-avatar";
import { MessagesEncryptionBadge } from "@/components/messages/messages-encryption-badge";
import { MessagesGroupSettingsSection } from "@/components/messages/messages-group-settings-section";
import { MessagesListRow } from "@/components/messages/messages-list-row";
import { MessagesQuickActions } from "@/components/messages/messages-quick-actions";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

type MessagesUserSidebarProps = {
  thread: MessageThread;
  onOpenMediaPanel?: (tab: "media" | "file") => void;
  onOpenMuteModal?: () => void;
};

const mediaItems = [
  { label: "Media", icon: Image },
  { label: "Files", icon: FileText },
];

function MessagesUserSidebarComponent({
  thread,
  onOpenMediaPanel,
  onOpenMuteModal,
}: MessagesUserSidebarProps) {
  const router = useRouter();
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const openConfirmation = useChatUiStore((state) => state.openConfirmation);
  const [searchQuery, setSearchQuery] = useState("");
  const presenceLabel = formatPresenceLabel(thread.presence);
  const currentMembership = thread.membership ?? null;
  const canManageGroupSettings = Boolean(
    thread.isGroup && currentMembership?.membership_state === "active",
  );
  const canManageMembers = Boolean(
    thread.isGroup && ["owner", "admin"].includes(currentMembership?.role ?? ""),
  );
  const { data: users = [] } = useUserSearchQuery(searchQuery, Boolean(canManageMembers));
  const archiveConversationMutation = useArchiveConversationMutation();
  const setConversationMuteMutation = useSetConversationMuteMutation();
  const unarchiveConversationMutation = useUnarchiveConversationMutation();
  const addMembersMutation = useAddGroupMembersMutation(thread.id);
  const changeRoleMutation = useChangeGroupRoleMutation(thread.id);
  const leaveGroupMutation = useLeaveGroupMutation(thread.id);
  const removeMemberMutation = useRemoveGroupMemberMutation(thread.id);

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
  const existingMemberIds = useMemo(
    () => new Set((thread.members ?? []).map((member) => member.user_id)),
    [thread.members],
  );
  const addableUsers = useMemo(
    () => users.filter((user) => !existingMemberIds.has(user.id)),
    [existingMemberIds, users],
  );

  const isArchived = Boolean(thread.membership?.archived_at);
  const isMuted = Boolean(thread.membership?.muted_until);
  const muteLabel = isMuted ? "Unmute notifications" : "Mute notifications";
  const isRequestConversation = currentMembership?.membership_state === "request_pending";
  const canStartVoiceCall = !thread.isChatBlocked && !isRequestConversation;

  const handleMuteAction = async () => {
    if (isMuted) {
      await setConversationMuteMutation.mutateAsync({
        conversationId: thread.id,
        mutedUntil: null,
      });
      return;
    }

    onOpenMuteModal?.();
  };

  const privacyItems = [
    { label: muteLabel, icon: Bell, action: () => void handleMuteAction() },
    ...(thread.isGroup
      ? [{
          label: "Leave Group",
          icon: LogOut,
          action: async () => {
            await leaveGroupMutation.mutateAsync();
            router.push("/messages");
          },
        }]
      : [{
          label: isArchived ? "Unarchive chat" : "Archive chat",
          icon: Archive,
          action: async () => {
            if (isArchived) {
              await unarchiveConversationMutation.mutateAsync(thread.id);
              return;
            }

            await archiveConversationMutation.mutateAsync(thread.id);
            router.push("/messages");
          },
        }, {
          label: "Block",
          icon: ShieldBan,
          action: () => openConfirmation("block", thread.id),
        }]),
    { label: "Verify end-to-end encryption", icon: Lock },
  ];

  const handleBadgeKeyDown = (
    event: React.KeyboardEvent<HTMLSpanElement>,
    action: () => void,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="surface h-full bg-[#fbfcff]">
      <div className="h-full overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center text-center">
          <MessageAvatar
            name={thread.name}
            online={thread.online}
            imageUrl={thread.avatarUrl}
            sizeClass="h-20 w-20"
            textClass="text-2xl"
          />

          <h2 className="mt-4 text-lg font-semibold tracking-tight">{thread.name}</h2>
          {presenceLabel ? (
            <p className={`mt-2 text-sm ${thread.online ? "text-emerald-600" : "text-[var(--muted)]"}`}>
              {presenceLabel}
            </p>
          ) : null}
          {thread.description ? <p className="mt-2 text-sm text-[var(--muted)]">{thread.description}</p> : null}
          <div className="mt-3">
            <MessagesEncryptionBadge />
          </div>

          <MessagesQuickActions
            onVoiceCallClick={
              canStartVoiceCall
                ? () => {
                    openAudioCallWindow({
                      conversationId: thread.id,
                      action: "start",
                      title: thread.name,
                      avatarUrl: thread.avatarUrl ?? null,
                      targetUserId:
                        !thread.isGroup && authUserId
                          ? getDirectCallTargetUserId(thread, authUserId)
                          : null,
                      isGroup: Boolean(thread.isGroup),
                    });
                  }
                : undefined
            }
            onMuteClick={() => {
              void handleMuteAction();
            }}
            isMuteActive={isMuted}
            muteLabel={muteLabel}
          />
        </div>

        <div className="mt-6 space-y-5">
          {thread.isGroup ? (
            <MessagesAccordionSection title="Group settings">
              <MessagesGroupSettingsSection
                key={`${thread.id}:${thread.name}:${thread.avatarObjectId ?? "none"}`}
                thread={thread}
                canManageGroup={canManageGroupSettings}
              />
            </MessagesAccordionSection>
          ) : null}

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
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {member.membership_state !== "active" ? (
                            <span className="rounded-full bg-rose-100 px-1.5 py-[2px] text-[8px] font-medium text-rose-600">
                              {member.membership_state}
                            </span>
                          ) : null}
                          {canManageMembers && member.role !== "owner" ? (
                            <>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  void changeRoleMutation.mutateAsync({
                                    userId: member.user_id,
                                    role: member.role === "admin" ? "member" : "admin",
                                  });
                                }}
                                onKeyDown={(event) => {
                                  handleBadgeKeyDown(event, () => {
                                    void changeRoleMutation.mutateAsync({
                                      userId: member.user_id,
                                      role: member.role === "admin" ? "member" : "admin",
                                    });
                                  });
                                }}
                                className="cursor-pointer rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-[2px] text-[8px] font-normal text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                              >
                                {member.role === "admin" ? "Make member" : "Make admin"}
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  void removeMemberMutation.mutateAsync(member.user_id);
                                }}
                                onKeyDown={(event) => {
                                  handleBadgeKeyDown(event, () => {
                                    void removeMemberMutation.mutateAsync(member.user_id);
                                  });
                                }}
                                className="cursor-pointer rounded-full border border-rose-200 bg-rose-50 px-1.5 py-[2px] text-[8px] font-normal text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
                              >
                                Remove
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                        {member.role === "owner" || member.role === "admin" ? (
                          <Crown className={`h-4 w-4 ${member.role === "owner" ? "text-amber-500" : "text-[var(--accent)]"}`} />
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}

                {canManageMembers ? (
                  <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3">
                    <div className="text-sm font-semibold text-[var(--foreground)]">Add members</div>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search users by name or username"
                      className="mt-3 w-full rounded-xl border border-[var(--line)] bg-[#fbfcff] px-3 py-2 text-sm outline-none"
                    />
                    <div className="mt-3 space-y-2">
                      {addableUsers.map((user) => (
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
                      {searchQuery.trim().length >= 2 && addableUsers.length === 0 ? (
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
          </MessagesAccordionSection>
        </div>
      </div>
    </div>
  );
}

export const MessagesUserSidebar = memo(MessagesUserSidebarComponent, (prev, next) =>
  prev.thread === next.thread &&
  prev.onOpenMediaPanel === next.onOpenMediaPanel &&
  prev.onOpenMuteModal === next.onOpenMuteModal,
);
