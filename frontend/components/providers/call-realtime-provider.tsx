"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";

import { getEchoInstance } from "@/lib/reverb";
import { queryKeys } from "@/lib/query-keys";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";
import { useCallStore } from "@/lib/stores/call-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { type CallSignalPayload, isCallTerminal } from "@/lib/calls-data";

function invalidateConversationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: number,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
}

export function CallRealtimeProvider() {
  const queryClient = useQueryClient();
  const { activeThreadId } = useChatUiStore(useShallow((state) => ({
    activeThreadId: state.activeThreadId,
  })));
  const {
    receiveIncomingCall,
    syncCallState,
    clearActiveCall,
  } = useCallStore(useShallow((state) => ({
    receiveIncomingCall: state.receiveIncomingCall,
    syncCallState: state.syncCallState,
    clearActiveCall: state.clearActiveCall,
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
      invalidateConversationQueries(queryClient, payload.call_room.conversation_id);
    };

    const handleStateChanged = (payload: CallSignalPayload) => {
      syncCallState(payload);
      invalidateConversationQueries(queryClient, payload.call_room.conversation_id);

      if (isCallTerminal(payload.call_room)) {
        clearActiveCall();
      }
    };

    userChannel.listen(".call.incoming", handleIncoming);
    userChannel.listen(".call.state.changed", handleStateChanged);

    return () => {
      echo.leave(`user.${userId}`);
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
      syncCallState(payload);
      invalidateConversationQueries(queryClient, payload.call_room.conversation_id);

      if (isCallTerminal(payload.call_room)) {
        clearActiveCall();
      }
    };

    conversationChannel.listen(".call.state.changed", handleStateChanged);

    return () => {
      echo.leave(`conversation.${activeThreadId}`);
    };
  }, [activeThreadId, clearActiveCall, queryClient, syncCallState]);

  return null;
}
