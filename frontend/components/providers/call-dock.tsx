"use client";

import { useEffect, useMemo } from "react";
import { useState } from "react";
import { BellOff, Lock, PhoneCall, PhoneMissed, PhoneOff, Radio, Video } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { apiClient } from "@/lib/api-client";
import { openCallWindow } from "@/lib/call-window";
import { type CallRoomApiItem, formatCallStatus, getCallParticipant } from "@/lib/calls-data";
import {
  useDeclineCallMutation,
  useEndCallMutation,
} from "@/lib/hooks/use-call-mutations";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { toConversationThread } from "@/lib/messages-data";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCallStore } from "@/lib/stores/call-store";

type CallRoomResponse = {
  data: CallRoomApiItem;
};

export function CallDock() {
  const { userId, settings } = useAuthStore(useShallow((state) => ({
    userId: state.user?.id ?? null,
    settings: state.settings,
  })));
  const { data: conversations = [] } = useConversationsQuery(Boolean(userId));
  const {
    incomingCall,
    activeCall,
    missedCallCount,
    lastMissedCall,
    clearIncomingCall,
    clearActiveCall,
    clearMissedCalls,
    hydrateCallRoom,
  } = useCallStore(useShallow((state) => ({
    incomingCall: state.incomingCall,
    activeCall: state.activeCall,
    missedCallCount: state.missedCallCount,
    lastMissedCall: state.lastMissedCall,
    clearIncomingCall: state.clearIncomingCall,
    clearActiveCall: state.clearActiveCall,
    clearMissedCalls: state.clearMissedCalls,
    hydrateCallRoom: state.hydrateCallRoom,
  })));
  const declineCallMutation = useDeclineCallMutation();
  const endCallMutation = useEndCallMutation();
  const [isAcceptingIncomingCall, setIsAcceptingIncomingCall] = useState(false);

  const session = incomingCall ?? activeCall;
  const isIncoming = Boolean(incomingCall && session && incomingCall.callRoom.room_uuid === session.callRoom.room_uuid);
  const conflictingActiveCall =
    incomingCall &&
    activeCall &&
    incomingCall.callRoom.room_uuid !== activeCall.callRoom.room_uuid
      ? activeCall
      : null;
  const isSilentAlert = useMemo(() => {
    if (!settings) {
      return false;
    }

    if (!settings.sound_enabled) {
      return true;
    }

    if (!settings.quiet_hours_enabled || !settings.quiet_hours_start || !settings.quiet_hours_end) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMinute] = settings.quiet_hours_start.split(":").map((value) => Number(value));
    const [endHour, endMinute] = settings.quiet_hours_end.split(":").map((value) => Number(value));
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
      return false;
    }

    return startMinutes <= endMinutes
      ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
      : currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }, [settings]);

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

  if (!userId) {
    return null;
  }

  const missedThread = lastMissedCall
    ? conversations
        .map((conversation) => toConversationThread(conversation))
        .find((item) => item.numericId === lastMissedCall.conversation_id)
    : null;

  if (!session && missedCallCount > 0 && lastMissedCall) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-[28px] border border-rose-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,247,0.98)_100%)] px-4 py-4 text-[#2f3655] shadow-[0_24px_70px_rgba(160,96,109,0.14)]">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <PhoneMissed className="h-4.5 w-4.5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#2f3655]">
              {missedCallCount} missed {missedCallCount === 1 ? "call" : "calls"}
            </p>
            <p className="mt-1 truncate text-xs text-[#6c759a]">
              {missedThread?.name ?? `Conversation #${lastMissedCall.conversation_id}`} - {lastMissedCall.media_type === "video" ? "Video" : "Voice"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                openCallWindow({
                  conversationId: lastMissedCall.conversation_id,
                  action: "start",
                  mediaType: lastMissedCall.media_type,
                  title: missedThread?.name,
                  avatarUrl: missedThread?.avatarUrl ?? null,
                  isGroup: Boolean(missedThread?.isGroup),
                });
                clearMissedCalls();
              }}
              className="rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(96,91,255,0.16)] transition hover:brightness-105"
            >
              Call back
            </button>

            <button
              type="button"
              onClick={clearMissedCalls}
              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const thread = conversations
    .map((conversation) => toConversationThread(conversation))
    .find((item) => item.numericId === session.callRoom.conversation_id);

  const participant = getCallParticipant(session.callRoom, userId);
  const isAccepted = participant?.invite_status === "accepted";
  const acceptRequested = isAcceptingIncomingCall;
  const declineRequested = declineCallMutation.isPending;
  const title = thread?.name ?? `Conversation #${session.callRoom.conversation_id}`;
  const shouldShowResumeCard =
    !isIncoming &&
    isAccepted &&
    activeCall?.callRoom.room_uuid === session.callRoom.room_uuid &&
    activeCall.source === "synced";
  const resumeLabel = shouldShowResumeCard ? "Move here" : "Resume";

  const handleAccept = async () => {
    setIsAcceptingIncomingCall(true);

    if (conflictingActiveCall) {
      await endCallMutation.mutateAsync({
        roomUuid: conflictingActiveCall.callRoom.room_uuid,
        reason: "switched_to_incoming_call",
      });
    }

    try {
      openCallWindow({
        conversationId: session.callRoom.conversation_id,
        action: "accept",
        mediaType: session.callRoom.media_type,
        roomUuid: session.callRoom.room_uuid,
        title,
        avatarUrl: thread?.avatarUrl ?? null,
        isGroup: Boolean(thread?.isGroup),
      });
      clearIncomingCall();
      clearActiveCall();
    } finally {
      setIsAcceptingIncomingCall(false);
    }
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

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {conflictingActiveCall ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                  <PhoneCall className="h-3 w-3" />
                  Busy on another call
                </span>
              ) : null}

              {isSilentAlert ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-600">
                  <BellOff className="h-3 w-3" />
                  Silent alert
                </span>
              ) : null}
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
                disabled={acceptRequested}
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
                  {acceptRequested ? "Accepting..." : conflictingActiveCall ? "Switch & accept" : "Accept"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (shouldShowResumeCard) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-[430px] items-center gap-3 rounded-[28px] border border-[rgba(111,123,176,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,248,255,0.98)_100%)] px-4 py-4 text-[#2f3655] shadow-[0_24px_70px_rgba(96,109,160,0.2)]">
          <MessageAvatar
            name={title}
            imageUrl={thread?.avatarUrl ?? null}
            sizeClass="h-12 w-12"
            textClass="text-base"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(96,91,255,0.08)] text-[var(--accent)]">
                <Radio className="h-4 w-4" />
              </span>
              <p className="truncate text-sm font-semibold text-[#2f3655]">
                Move active {session.callRoom.media_type === "video" ? "video" : "voice"} call here
              </p>
            </div>

            <p className="mt-1 truncate text-xs text-[#6c759a]">
              {title} - {formatCallStatus(session.callRoom)} - live on another device
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                openCallWindow({
                  conversationId: session.callRoom.conversation_id,
                  action: "join",
                  mediaType: session.callRoom.media_type,
                  roomUuid: session.callRoom.room_uuid,
                  title,
                  avatarUrl: thread?.avatarUrl ?? null,
                  isGroup: Boolean(thread?.isGroup),
                });
              }}
              className="rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(96,91,255,0.16)] transition hover:brightness-105"
            >
              {resumeLabel}
            </button>

            <button
              type="button"
              onClick={() => {
                void endCallMutation.mutateAsync({
                  roomUuid: session.callRoom.room_uuid,
                  reason: "ended_from_resume_card",
                });
              }}
              disabled={endCallMutation.isPending}
              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {endCallMutation.isPending ? "Ending..." : "End"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
