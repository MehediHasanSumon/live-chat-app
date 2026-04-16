"use client";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { getCallParticipant, type CallRoomApiItem } from "@/lib/calls-data";
import { type ConversationMembership } from "@/lib/messages-data";

function isInviteable(
  membership: ConversationMembership,
  callRoom: CallRoomApiItem,
  authUserId: number | null,
): boolean {
  if (membership.membership_state !== "active" || membership.user_id === authUserId) {
    return false;
  }

  const participant = getCallParticipant(callRoom, membership.user_id);

  if (!participant) {
    return true;
  }

  return ["left", "declined", "missed", "kicked"].includes(participant.invite_status);
}

export function CallInviteManager({
  members,
  callRoom,
  authUserId,
  invitingUserId,
  onInviteUser,
}: {
  members: ConversationMembership[];
  callRoom: CallRoomApiItem;
  authUserId: number | null;
  invitingUserId?: number | null;
  onInviteUser?: (userId: number) => void;
}) {
  if (typeof onInviteUser !== "function") {
    return null;
  }

  const inviteableMembers = members.filter((membership) => isInviteable(membership, callRoom, authUserId));

  if (inviteableMembers.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {inviteableMembers.map((membership) => {
        const name =
          membership.user?.name ??
          membership.user?.username ??
          `User #${membership.user_id}`;

        return (
          <div
            key={membership.id}
            className="flex min-w-[188px] items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5"
          >
            <MessageAvatar
              name={name}
              imageUrl={membership.user?.avatar_object?.download_url ?? null}
              sizeClass="h-10 w-10"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white/92">{name}</p>
              <p className="truncate text-[11px] text-white/55">Available to invite</p>
            </div>

            <button
              type="button"
              onClick={() => {
                onInviteUser(membership.user_id);
              }}
              disabled={invitingUserId === membership.user_id}
              className="rounded-full border border-emerald-300/18 bg-emerald-500/14 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {invitingUserId === membership.user_id ? "Inviting..." : "Invite"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
