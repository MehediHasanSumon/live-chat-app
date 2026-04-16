"use client";

import { useEffect } from "react";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";

import { type ConversationApiItem, type MessageApiItem } from "@/lib/messages-data";
import { type ConversationMessagesResponse } from "@/lib/hooks/use-conversation-messages-query";
import { type ConversationsResponse } from "@/lib/hooks/use-conversations-query";
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

type MessageCreatedPayload = {
  message: MessageApiItem;
};

type ConversationResponse = {
  data: ConversationApiItem;
};

type ConversationDetailCache = ConversationApiItem | ConversationResponse | undefined;

function buildConversationPreview(message: MessageApiItem): string {
  if (message.display_text?.trim()) {
    return message.display_text.trim();
  }

  if (message.text_body?.trim()) {
    return message.text_body.trim();
  }

  return "New message";
}

function patchConversationMessageState(
  conversation: ConversationApiItem,
  message: MessageApiItem,
): ConversationApiItem {
  if (String(conversation.id) !== String(message.conversation_id)) {
    return conversation;
  }

  if ((conversation.last_message_seq ?? 0) >= message.seq) {
    return conversation;
  }

  return {
    ...conversation,
    last_message_seq: message.seq,
    last_message_id: message.id,
    last_message_preview: buildConversationPreview(message),
    last_message_at: message.created_at,
    updated_at: message.updated_at,
  };
}

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

    const patchConversationState = (message: MessageApiItem) => {
      queryClient.setQueriesData<ConversationsResponse>({ queryKey: queryKeys.conversations.lists }, (current) => {
        if (!current?.data) {
          return current;
        }

        return {
          ...current,
          data: current.data.map((conversation) => patchConversationMessageState(conversation, message)),
        };
      });

      queryClient.setQueryData<ConversationDetailCache>(queryKeys.conversations.detail(activeThreadId), (current) => {
        if (!current) {
          return current;
        }

        if (!("data" in current)) {
          return patchConversationMessageState(current, message);
        }

        return {
          ...current,
          data: patchConversationMessageState(current.data, message),
        };
      });

      queryClient.setQueryData<InfiniteData<ConversationMessagesResponse, number | null>>(
        queryKeys.messages.list(activeThreadId),
        (current) => {
          if (!current?.pages?.length) {
            return current;
          }

          const firstPage = current.pages[0];

          if (firstPage.data.some((item) => item.id === message.id)) {
            return current;
          }

          return {
            ...current,
            pages: [
              {
                ...firstPage,
                data: [...firstPage.data, message].sort((left, right) => left.seq - right.seq),
              },
              ...current.pages.slice(1),
            ],
          };
        },
      );
    };

    const handleMessageCreated = (payload: MessageCreatedPayload) => {
      if (!payload.message || String(payload.message.conversation_id) !== activeThreadId) {
        return;
      }

      patchConversationState(payload.message);
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
