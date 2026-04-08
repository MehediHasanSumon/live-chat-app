"use client";

import { PhoneCall, PhoneOff, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { hasSessionHint } from "@/lib/api-client";
import {
  formatCallStatus,
  getCallLabel,
  getCallParticipant,
} from "@/lib/calls-data";
import {
  useAcceptCallMutation,
  useDeclineCallMutation,
  useEndCallMutation,
  useJoinCallMutation,
} from "@/lib/hooks/use-call-mutations";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { toConversationThread } from "@/lib/messages-data";
import { useCallStore } from "@/lib/stores/call-store";

export function CallDock() {
  const router = useRouter();
  const { data: authMe } = useAuthMeQuery(hasSessionHint());
  const { data: conversations = [] } = useConversationsQuery(Boolean(authMe?.data.user.id));
  const incomingCall = useCallStore((state) => state.incomingCall);
  const activeCall = useCallStore((state) => state.activeCall);
  const isRoomOpen = useCallStore((state) => state.isRoomOpen);
  const openRoom = useCallStore((state) => state.openRoom);
  const clearIncomingCall = useCallStore((state) => state.clearIncomingCall);
  const clearActiveCall = useCallStore((state) => state.clearActiveCall);
  const userId = authMe?.data.user.id ?? null;
  const acceptCallMutation = useAcceptCallMutation();
  const declineCallMutation = useDeclineCallMutation();
  const endCallMutation = useEndCallMutation();
  const joinCallMutation = useJoinCallMutation();

  const session = incomingCall ?? activeCall;

  if (!session || !userId || Boolean(activeCall?.token && isRoomOpen && !incomingCall)) {
    return null;
  }

  const thread = conversations
    .map((conversation) => toConversationThread(conversation))
    .find((item) => item.numericId === session.callRoom.conversation_id);

  const participant = getCallParticipant(session.callRoom, userId);
  const isIncoming = Boolean(incomingCall && incomingCall.callRoom.room_uuid === session.callRoom.room_uuid);
  const isAccepted = participant?.invite_status === "accepted";
  const hasJoinToken = Boolean(activeCall?.token && activeCall.callRoom.room_uuid === session.callRoom.room_uuid);
  const canOfferVideoJoin = session.callRoom.media_type === "video";

  const joinRequested = joinCallMutation.isPending;
  const acceptRequested = acceptCallMutation.isPending;
  const declineRequested = declineCallMutation.isPending;
  const endRequested = endCallMutation.isPending;

  const title = thread?.name ?? `Conversation #${session.callRoom.conversation_id}`;
  const subtitle = hasJoinToken
    ? `Join ready in ${activeCall?.publishMode === "video" ? "video" : "audio"} mode`
    : `${getCallLabel(session.callRoom)} · ${formatCallStatus(session.callRoom)}`;

  const handleAccept = async () => {
    await acceptCallMutation.mutateAsync(session.callRoom.room_uuid);
    router.push(`/messages/t/${session.callRoom.conversation_id}`);
    await joinCallMutation.mutateAsync({
      roomUuid: session.callRoom.room_uuid,
      wantsVideo: session.callRoom.media_type === "video",
    });
  };

  const handleJoin = async (wantsVideo: boolean) => {
    router.push(`/messages/t/${session.callRoom.conversation_id}`);
    await joinCallMutation.mutateAsync({
      roomUuid: session.callRoom.room_uuid,
      wantsVideo,
    });
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 w-[min(92vw,360px)]">
      <div className="pointer-events-auto rounded-[26px] border border-[rgba(111,123,176,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,248,255,0.98)_100%)] p-4 shadow-[0_24px_60px_rgba(96,109,160,0.18)] backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8f97bb]">
              {isIncoming ? "Incoming Call" : "Call Console"}
            </p>
            <h3 className="text-lg font-semibold text-[#2f3655]">{title}</h3>
            <p className="text-sm text-[#7f89b2]">{subtitle}</p>
          </div>
          <span className="rounded-full bg-[rgba(96,91,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
            {session.callRoom.media_type === "video" ? "Video" : "Voice"}
          </span>
        </div>

          {activeCall?.token ? (
          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white/90 px-3 py-3 text-sm text-[#6b7395]">
            Token ready for room <span className="font-medium text-[#3b4260]">{session.callRoom.room_uuid.slice(0, 8)}</span>.
          </div>
        ) : null}

        {joinCallMutation.error ? (
          <p className="mt-3 text-sm text-rose-500">We could not prepare the LiveKit join token.</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {isIncoming && !isAccepted ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void handleAccept();
                }}
                disabled={acceptRequested || joinRequested}
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(96,91,255,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PhoneCall className="h-4 w-4" />
                Accept
              </button>
              <button
                type="button"
                onClick={() => {
                  void declineCallMutation.mutateAsync(session.callRoom.room_uuid);
                }}
                disabled={declineRequested}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[#5e678f] transition hover:border-rose-200 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PhoneOff className="h-4 w-4" />
                Decline
              </button>
            </>
          ) : null}

          {!hasJoinToken && isAccepted ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void handleJoin(false);
                }}
                disabled={joinRequested}
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(96,91,255,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PhoneCall className="h-4 w-4" />
                Join Audio
              </button>
              {canOfferVideoJoin ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleJoin(true);
                  }}
                  disabled={joinRequested}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(96,91,255,0.18)] bg-white px-4 py-2 text-sm font-medium text-[var(--accent)] transition hover:border-[rgba(96,91,255,0.34)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Video className="h-4 w-4" />
                  Join Video
                </button>
              ) : null}
            </>
          ) : null}

          {hasJoinToken ? (
            <button
              type="button"
              onClick={openRoom}
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(96,91,255,0.22)] transition hover:brightness-105"
            >
              <Video className="h-4 w-4" />
              Resume room
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void endCallMutation.mutateAsync({ roomUuid: session.callRoom.room_uuid });
            }}
            disabled={endRequested}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[#5e678f] transition hover:border-rose-200 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PhoneOff className="h-4 w-4" />
            End
          </button>

          <button
            type="button"
            onClick={isIncoming ? clearIncomingCall : clearActiveCall}
            className="rounded-full px-3 py-2 text-sm text-[#8f97bb] transition hover:text-[#5e678f]"
          >
            Hide
          </button>

          <Link
            href={`/messages/t/${session.callRoom.conversation_id}`}
            className="rounded-full px-3 py-2 text-sm text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
          >
            Open chat
          </Link>
        </div>
      </div>
    </div>
  );
}
