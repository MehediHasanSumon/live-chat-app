"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";

import { apiClient } from "@/lib/api-client";
import { listenToPopupClosingSignals } from "@/lib/call-popup-sync";
import { type ConversationApiItem } from "@/lib/messages-data";
import { getEchoInstance } from "@/lib/reverb";
import { queryKeys } from "@/lib/query-keys";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";
import { useCallStore } from "@/lib/stores/call-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  type CallRoomApiItem,
  type CallSignalPayload,
  getCallParticipant,
  isCallParticipantInactive,
  isCallTerminal,
} from "@/lib/calls-data";

type CallRoomResponse = {
  data: CallRoomApiItem;
};

type ConversationsCache = ConversationApiItem[] | { data?: ConversationApiItem[] } | undefined;
type ConversationDetailCache = ConversationApiItem | { data: ConversationApiItem } | undefined;

function patchConversationCallState(conversation: ConversationApiItem, callRoom: CallRoomApiItem): ConversationApiItem {
  if (conversation.id !== callRoom.conversation_id) {
    return conversation;
  }

  return {
    ...conversation,
    active_room_uuid: isCallTerminal(callRoom) ? null : callRoom.room_uuid,
  };
}

function patchConversationCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  callRoom: CallRoomApiItem,
) {
  queryClient.setQueriesData<ConversationsCache>({ queryKey: queryKeys.conversations.lists }, (current) => {
    if (Array.isArray(current)) {
      return current.map((conversation) => patchConversationCallState(conversation, callRoom));
    }

    if (current?.data) {
      return {
        ...current,
        data: current.data.map((conversation) => patchConversationCallState(conversation, callRoom)),
      };
    }

    return current;
  });

  queryClient.setQueryData<ConversationDetailCache>(queryKeys.conversations.detail(callRoom.conversation_id), (current) => {
    if (!current) {
      return current;
    }

    if ("data" in current) {
      return {
        ...current,
        data: patchConversationCallState(current.data, callRoom),
      };
    }

    return patchConversationCallState(current, callRoom);
  });
}

export function CallRealtimeProvider() {
  const queryClient = useQueryClient();
  const handledPopupClosuresRef = useRef(new Map<string, number>());
  const { activeThreadId } = useChatUiStore(useShallow((state) => ({
    activeThreadId: state.activeThreadId,
  })));
  const {
    receiveIncomingCall,
    syncCallState,
    clearActiveCall,
    hydrateCallRoom,
  } = useCallStore(useShallow((state) => ({
    receiveIncomingCall: state.receiveIncomingCall,
    syncCallState: state.syncCallState,
    clearActiveCall: state.clearActiveCall,
    hydrateCallRoom: state.hydrateCallRoom,
  })));
  const { userId } = useAuthStore(useShallow((state) => ({
    userId: state.user?.id ?? null,
  })));

  useEffect(() => {
    if (!userId) {
      return;
    }

    const echo = getEchoInstance();

    if (!echo) {
      return;
    }

    const userChannel = echo.private(`user.${userId}`);

    const handleIncoming = (payload: CallSignalPayload) => {
      receiveIncomingCall(payload);
      patchConversationCaches(queryClient, payload.call_room);
    };

    const handleStateChanged = (payload: CallSignalPayload) => {
      syncCallState(payload, userId);
      patchConversationCaches(queryClient, payload.call_room);

      const participant = getCallParticipant(payload.call_room, userId);

      if (isCallTerminal(payload.call_room) || isCallParticipantInactive(participant)) {
        clearActiveCall();
      }
    };

    userChannel.listen(".call.incoming", handleIncoming);
    userChannel.listen(".call.state.changed", handleStateChanged);

    return () => {
      userChannel.stopListening(".call.incoming");
      userChannel.stopListening(".call.state.changed");
    };
  }, [clearActiveCall, queryClient, receiveIncomingCall, syncCallState, userId]);

  useEffect(() => {
    if (!activeThreadId) {
      return;
    }

    const echo = getEchoInstance();

    if (!echo) {
      return;
    }

    const conversationChannel = echo.private(`conversation.${activeThreadId}`);

    const handleStateChanged = (payload: CallSignalPayload) => {
      syncCallState(payload, userId);
      patchConversationCaches(queryClient, payload.call_room);

      const participant = getCallParticipant(payload.call_room, userId);

      if (isCallTerminal(payload.call_room) || isCallParticipantInactive(participant)) {
        clearActiveCall();
      }
    };

    conversationChannel.listen(".call.state.changed", handleStateChanged);

    return () => {
      echo.leave(`conversation.${activeThreadId}`);
    };
  }, [activeThreadId, clearActiveCall, queryClient, syncCallState, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    return listenToPopupClosingSignals((signal) => {
      const now = Date.now();
      const lastHandledAt = handledPopupClosuresRef.current.get(signal.roomUuid) ?? 0;

      if (now - lastHandledAt < 2_000) {
        return;
      }

      handledPopupClosuresRef.current.set(signal.roomUuid, now);
      const activeRoomUuid = useCallStore.getState().activeCall?.callRoom.room_uuid;

      if (activeRoomUuid === signal.roomUuid) {
        clearActiveCall();
      }

      void apiClient
        .get<CallRoomResponse>(`/api/calls/${signal.roomUuid}`, {
          skipAuthRedirect: true,
        })
        .then((response) => {
          if (!userId || isCallTerminal(response.data)) {
            return;
          }

          hydrateCallRoom(response.data, userId);
        })
        .catch(() => {
          // Ignore popup sync fetch failures and fall back to query invalidation.
        });

      if (signal.conversationId != null) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(signal.conversationId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(signal.conversationId) });
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    });
  }, [clearActiveCall, hydrateCallRoom, queryClient, userId]);

  return null;
}
