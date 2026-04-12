"use client";

import { useEffect } from "react";
import { Lock, PhoneCall, PhoneOff, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { apiClient } from "@/lib/api-client";
import { openAudioCallWindow } from "@/lib/call-window";
import {
  type CallRoomApiItem,
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
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { toConversationThread } from "@/lib/messages-data";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCallStore } from "@/lib/stores/call-store";

type CallRoomResponse = {
  data: CallRoomApiItem;
};

export function CallDock() {
  const router = useRouter();
  const { userId } = useAuthStore(useShallow((state) => ({
    userId: state.user?.id ?? null,
  })));
  const { data: conversations = [] } = useConversationsQuery(Boolean(userId));
  const {
    incomingCall,
    activeCall,
    isRoomOpen,
    openRoom,
    clearIncomingCall,
    clearActiveCall,
    hydrateCallRoom,
  } = useCallStore(useShallow((state) => ({
    incomingCall: state.incomingCall,
    activeCall: state.activeCall,
    isRoomOpen: state.isRoomOpen,
    openRoom: state.openRoom,
    clearIncomingCall: state.clearIncomingCall,
    clearActiveCall: state.clearActiveCall,
    hydrateCallRoom: state.hydrateCallRoom,
  })));
  const acceptCallMutation = useAcceptCallMutation();
  const declineCallMutation = useDeclineCallMutation();
  const endCallMutation = useEndCallMutation();
  const joinCallMutation = useJoinCallMutation();

  const session = incomingCall ?? activeCall;
  const isIncoming = Boolean(incomingCall && session && incomingCall.callRoom.room_uuid === session.callRoom.room_uuid);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const knownRoomUuid = incomingCall?.callRoom.room_uuid ?? activeCall?.callRoom.room_uuid ?? null;
    const activeConversationRoom = conversations.find((conversation) => {
      if (!conversation.active_room_uuid) {
        return false;
      }

      return conversation.active_room_uuid !== knownRoomUuid;
    });

    if (!activeConversationRoom?.active_room_uuid) {
      return;
    }

    let isCancelled = false;

    const hydrateFromConversation = async () => {
      try {
        const response = await apiClient.get<CallRoomResponse>(`/api/calls/${activeConversationRoom.active_room_uuid}`, {
          skipAuthRedirect: true,
        });

        if (!isCancelled) {
          hydrateCallRoom(response.data, userId);
        }
      } catch {
        // Ignore fallback hydration failures; realtime events remain the primary path.
      }
    };

    void hydrateFromConversation();

    return () => {
      isCancelled = true;
    };
  }, [activeCall?.callRoom.room_uuid, conversations, hydrateCallRoom, incomingCall?.callRoom.room_uuid, userId]);

  if (!session || !userId || Boolean(activeCall?.token && isRoomOpen && !incomingCall)) {
    return null;
  }

  const thread = conversations
    .map((conversation) => toConversationThread(conversation))
    .find((item) => item.numericId === session.callRoom.conversation_id);

  const participant = getCallParticipant(session.callRoom, userId);
  const isAccepted = participant?.invite_status === "accepted";
  const hasJoinToken = Boolean(activeCall?.token && activeCall.callRoom.room_uuid === session.callRoom.room_uuid);
  const canOfferVideoJoin = session.callRoom.media_type === "video";

  if (!isIncoming && !hasJoinToken) {
    return null;
  }

  const joinRequested = joinCallMutation.isPending;
  const acceptRequested = acceptCallMutation.isPending;
  const declineRequested = declineCallMutation.isPending;
  const endRequested = endCallMutation.isPending;

  const title = thread?.name ?? `Conversation #${session.callRoom.conversation_id}`;
  const subtitle = hasJoinToken
    ? `Join ready in ${activeCall?.publishMode === "video" ? "video" : "audio"} mode`
    : `${getCallLabel(session.callRoom)} · ${formatCallStatus(session.callRoom)}`;

  const handleAccept = async () => {
    if (session.callRoom.media_type === "voice") {
      const acceptedCallRoom = await acceptCallMutation.mutateAsync(session.callRoom.room_uuid);
      const popup = openAudioCallWindow({
        conversationId: session.callRoom.conversation_id,
        action: "join",
        roomUuid: acceptedCallRoom.room_uuid,
        title,
        avatarUrl: thread?.avatarUrl ?? null,
        isGroup: Boolean(thread?.isGroup),
      });

      if (popup) {
        clearIncomingCall();
        clearActiveCall();
        return;
      }

      router.push(`/messages/t/${session.callRoom.conversation_id}`);
      await joinCallMutation.mutateAsync({
        roomUuid: acceptedCallRoom.room_uuid,
        wantsVideo: false,
      });
      return;
    }

    await acceptCallMutation.mutateAsync(session.callRoom.room_uuid);
    router.push(`/messages/t/${session.callRoom.conversation_id}`);
    await joinCallMutation.mutateAsync({
      roomUuid: session.callRoom.room_uuid,
      wantsVideo: session.callRoom.media_type === "video",
    });
  };

  const handleJoin = async (wantsVideo: boolean) => {
    if (!wantsVideo && session.callRoom.media_type === "voice") {
      const popup = openAudioCallWindow({
        conversationId: session.callRoom.conversation_id,
        action: "join",
        roomUuid: session.callRoom.room_uuid,
      });

      if (popup) {
        clearIncomingCall();
        clearActiveCall();
        return;
      }
    }

    router.push(`/messages/t/${session.callRoom.conversation_id}`);
    await joinCallMutation.mutateAsync({
      roomUuid: session.callRoom.room_uuid,
      wantsVideo,
    });
  };

  if (isIncoming && !isAccepted) {
    return (
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,34,54,0.1)] px-4 py-6">
        <div className="pointer-events-auto w-full max-w-[372px] overflow-hidden rounded-[32px] border border-[rgba(111,123,176,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,248,255,0.98)_100%)] px-6 py-7 text-[#2f3655] shadow-[0_28px_80px_rgba(96,109,160,0.22)]">
          <div className="flex justify-center text-center">
            <p className="text-[12px] font-semibold tracking-[-0.02em] text-[#3e4565]">Incoming call</p>
          </div>

          <div className="mt-5 flex flex-col items-center text-center">
            <MessageAvatar
              name={title}
              imageUrl={thread?.avatarUrl ?? null}
              sizeClass="h-[78px] w-[78px]"
              textClass="text-[24px]"
            />

            <p className="mt-5 max-w-[230px] text-[18px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#2f3655]">
              {title} is calling you
            </p>

            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[rgba(96,91,255,0.08)] px-2.5 py-1.5 text-[11px] text-[#6c759a]">
              <Lock className="h-3 w-3" />
              End-to-end encrypted
            </div>

            <div className="mt-8 flex items-start justify-center gap-8">
              <button
                type="button"
                onClick={() => {
                  void declineCallMutation.mutateAsync(session.callRoom.room_uuid);
                }}
                disabled={declineRequested}
                className="group flex flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff5d72_0%,#ff3f62_100%)] text-white shadow-[0_12px_20px_rgba(255,74,108,0.22)] transition group-hover:scale-[1.03]">
                  <PhoneOff className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-semibold text-[#4c5478]">Decline</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleAccept();
                }}
                disabled={acceptRequested || joinRequested}
                className="group flex flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#46c95d_0%,#2faa48_100%)] text-white shadow-[0_12px_20px_rgba(52,181,77,0.2)] transition group-hover:scale-[1.03]">
                  {session.callRoom.media_type === "video" ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <PhoneCall className="h-4 w-4" />
                  )}
                </span>
                <span className="text-[11px] font-semibold text-[#4c5478]">
                  {acceptRequested || joinRequested ? "Accepting..." : "Accept"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
