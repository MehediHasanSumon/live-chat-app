"use client";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { type CallRoomParticipantApiItem } from "@/lib/calls-data";

function formatParticipantState(status: CallRoomParticipantApiItem["invite_status"]): string {
  switch (status) {
    case "accepted":
      return "In call";
    case "ringing":
      return "Ringing";
    case "invited":
      return "Invited";
    case "kicked":
      return "Removed";
    case "left":
      return "Left";
    default:
      return status;
  }
}

export function CallParticipantManager({
  participants,
  authUserId,
  createdBy,
  removingUserId,
  onRemoveParticipant,
}: {
  participants: CallRoomParticipantApiItem[];
  authUserId: number | null;
  createdBy: number;
  removingUserId?: number | null;
  onRemoveParticipant?: (userId: number) => void;
}) {
  const visibleParticipants = participants.filter((participant) => participant.user_id !== authUserId);

  if (visibleParticipants.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {visibleParticipants.map((participant) => {
        const name =
          participant.user?.name ??
          participant.user?.username ??
          `User #${participant.user_id}`;
        const canRemove =
          typeof onRemoveParticipant === "function" &&
          participant.user_id !== createdBy &&
          !["left", "declined", "missed", "kicked"].includes(participant.invite_status);

        return (
          <div
            key={participant.id}
            className="flex min-w-[188px] items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5"
          >
            <MessageAvatar name={name} online={participant.invite_status === "accepted"} sizeClass="h-10 w-10" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white/92">{name}</p>
              <p className="truncate text-[11px] text-white/55">{formatParticipantState(participant.invite_status)}</p>
            </div>

            {canRemove ? (
              <button
                type="button"
                onClick={() => {
                  onRemoveParticipant(participant.user_id);
                }}
                disabled={removingUserId === participant.user_id}
                className="rounded-full border border-rose-300/20 bg-rose-500/12 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingUserId === participant.user_id ? "Removing..." : "Remove"}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
