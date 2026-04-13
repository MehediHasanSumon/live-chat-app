"use client";

import { useEffect } from "react";
import { Lock, PhoneCall, PhoneOff, Video } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { apiClient } from "@/lib/api-client";
import { openCallWindow } from "@/lib/call-window";
import { type CallRoomApiItem, getCallParticipant } from "@/lib/calls-data";
import {
  useAcceptCallMutation,
  useDeclineCallMutation,
} from "@/lib/hooks/use-call-mutations";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { toConversationThread } from "@/lib/messages-data";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCallStore } from "@/lib/stores/call-store";

type CallRoomResponse = {
  data: CallRoomApiItem;
};

export function CallDock() {
  const { userId } = useAuthStore(useShallow((state) => ({
    userId: state.user?.id ?? null,
  })));
  const { data: conversations = [] } = useConversationsQuery(Boolean(userId));
  const {
    incomingCall,
    activeCall,
    clearIncomingCall,
    clearActiveCall,
    hydrateCallRoom,
  } = useCallStore(useShallow((state) => ({
    incomingCall: state.incomingCall,
    activeCall: state.activeCall,
    clearIncomingCall: state.clearIncomingCall,
    clearActiveCall: state.clearActiveCall,
    hydrateCallRoom: state.hydrateCallRoom,
  })));
  const acceptCallMutation = useAcceptCallMutation();
  const declineCallMutation = useDeclineCallMutation();

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

  if (!session || !userId) {
    return null;
  }

  const thread = conversations
    .map((conversation) => toConversationThread(conversation))
    .find((item) => item.numericId === session.callRoom.conversation_id);

  const participant = getCallParticipant(session.callRoom, userId);
  const isAccepted = participant?.invite_status === "accepted";
  const acceptRequested = acceptCallMutation.isPending;
  const declineRequested = declineCallMutation.isPending;
  const title = thread?.name ?? `Conversation #${session.callRoom.conversation_id}`;

  const handleAccept = async () => {
    const acceptedCallRoom = await acceptCallMutation.mutateAsync(session.callRoom.room_uuid);
    openCallWindow({
      conversationId: session.callRoom.conversation_id,
      action: "join",
      mediaType: acceptedCallRoom.media_type,
      roomUuid: acceptedCallRoom.room_uuid,
      title,
      avatarUrl: thread?.avatarUrl ?? null,
      isGroup: Boolean(thread?.isGroup),
    });
    clearIncomingCall();
    clearActiveCall();
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
                  {acceptRequested ? "Accepting..." : "Accept"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
