"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";

import { queryKeys } from "@/lib/query-keys";
import { getEchoInstance } from "@/lib/reverb";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";
import { useConversationRealtimeStore } from "@/lib/stores/conversation-realtime-store";
import { pushToast } from "@/lib/stores/toast-store";
import { type MessageApiItem } from "@/lib/messages-data";

type TypingEventPayload = {
  conversation_id: number;
  user: {
    id: number;
    name: string;
  };
};

type MessageCreatedPayload = {
  message: MessageApiItem;
};

export function ConversationRealtimeProvider() {
  const queryClient = useQueryClient();
  const { activeThreadId } = useChatUiStore(useShallow((state) => ({
    activeThreadId: state.activeThreadId,
  })));
  const { authUserId } = useAuthStore(useShallow((state) => ({
    authUserId: state.user?.id ?? null,
  })));
  const {
    addTypingUser,
    removeTypingUser,
    clearConversation,
  } = useConversationRealtimeStore(useShallow((state) => ({
    addTypingUser: state.addTypingUser,
    removeTypingUser: state.removeTypingUser,
    clearConversation: state.clearConversation,
  })));

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

    const handleMessageCreated = (payload: MessageCreatedPayload) => {
      invalidateConversationState();

      if (!payload.message || payload.message.sender_id === authUserId) {
        return;
      }

      pushToast({
        id: `message-${payload.message.id}`,
        kind: "message",
        tone: "message",
        title: payload.message.sender?.name ?? "New message",
        senderName: payload.message.sender?.name ?? "Someone",
        message: payload.message.display_text ?? payload.message.text_body ?? "Sent you a message.",
        conversationId: String(payload.message.conversation_id),
      });
    };

    const channel = echo.private(`conversation.${activeThreadId}`);
    const presenceChannel = echo.join(`conversation.${activeThreadId}`);

    channel.listen(".message.created", handleMessageCreated);
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
