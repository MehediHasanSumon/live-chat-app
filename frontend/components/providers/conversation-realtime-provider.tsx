"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getEchoInstance } from "@/lib/reverb";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";
import { useConversationRealtimeStore } from "@/lib/stores/conversation-realtime-store";

type TypingEventPayload = {
  conversation_id: number;
  user: {
    id: number;
    name: string;
  };
};

export function ConversationRealtimeProvider() {
  const queryClient = useQueryClient();
  const activeThreadId = useChatUiStore((state) => state.activeThreadId);
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const addTypingUser = useConversationRealtimeStore((state) => state.addTypingUser);
  const removeTypingUser = useConversationRealtimeStore((state) => state.removeTypingUser);
  const clearConversation = useConversationRealtimeStore((state) => state.clearConversation);

  useEffect(() => {
    if (!activeThreadId) {
      return;
    }

    const echo = getEchoInstance();

    if (!echo) {
      return;
    }

    const invalidateConversationState = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(activeThreadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(activeThreadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    };

    const channel = echo.private(`conversation.${activeThreadId}`);
    const presenceChannel = echo.join(`conversation.${activeThreadId}`);

    channel.listen(".message.created", invalidateConversationState);
    channel.listen(".message.updated", invalidateConversationState);
    channel.listen(".message.deleted", invalidateConversationState);
    channel.listen(".reaction.changed", invalidateConversationState);
    channel.listen(".conversation.read", invalidateConversationState);

    presenceChannel.listen(".typing.started", (payload: TypingEventPayload) => {
      if (payload.user.id === authUserId) {
        return;
      }

      addTypingUser(String(payload.conversation_id), payload.user);
    });

    presenceChannel.listen(".typing.stopped", (payload: TypingEventPayload) => {
      removeTypingUser(String(payload.conversation_id), payload.user.id);
    });

    return () => {
      clearConversation(activeThreadId);
      echo.leave(`conversation.${activeThreadId}`);
    };
  }, [activeThreadId, addTypingUser, authUserId, clearConversation, queryClient, removeTypingUser]);

  return null;
}
