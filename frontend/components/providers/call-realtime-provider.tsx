"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { shouldBootstrapAuth } from "@/lib/api-client";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { getEchoInstance } from "@/lib/reverb";
import { queryKeys } from "@/lib/query-keys";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";
import { useCallStore } from "@/lib/stores/call-store";
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
  const { data: authMe } = useAuthMeQuery(shouldBootstrapAuth());
  const activeThreadId = useChatUiStore((state) => state.activeThreadId);
  const receiveIncomingCall = useCallStore((state) => state.receiveIncomingCall);
  const syncCallState = useCallStore((state) => state.syncCallState);
  const clearActiveCall = useCallStore((state) => state.clearActiveCall);
  const userId = authMe?.data.user.id ?? null;

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
