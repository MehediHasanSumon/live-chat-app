"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { shouldBootstrapAuth } from "@/lib/api-client";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { type MessageApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";
import { getEchoInstance } from "@/lib/reverb";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";
import { useConversationRealtimeStore } from "@/lib/stores/conversation-realtime-store";

type MessageEventPayload = {
  message: MessageApiItem;
};

type ReactionEventPayload = {
  message_id: number;
  reactions: MessageApiItem["reactions"];
};

type TypingEventPayload = {
  conversation_id: number;
  user: {
    id: number;
    name: string;
  };
};

function upsertMessage(current: MessageApiItem[] | undefined, nextMessage: MessageApiItem) {
  const existing = current ?? [];
  const next = existing.filter((message) => message.id !== nextMessage.id);
  next.push(nextMessage);
  return next.sort((left, right) => left.seq - right.seq);
}

export function ConversationRealtimeProvider() {
  const queryClient = useQueryClient();
  const activeThreadId = useChatUiStore((state) => state.activeThreadId);
  const addTypingUser = useConversationRealtimeStore((state) => state.addTypingUser);
  const removeTypingUser = useConversationRealtimeStore((state) => state.removeTypingUser);
  const clearConversation = useConversationRealtimeStore((state) => state.clearConversation);
  const { data: authMe } = useAuthMeQuery(shouldBootstrapAuth());
  const authUserId = authMe?.data.user.id ?? null;

  useEffect(() => {
    if (!activeThreadId) {
      return;
    }

    const echo = getEchoInstance();

    if (!echo) {
      return;
    }

    const channel = echo.private(`conversation.${activeThreadId}`);
    const presenceChannel = echo.join(`conversation.${activeThreadId}`);

    const invalidateConversation = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(activeThreadId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    };

    channel.listen(".message.created", (payload: MessageEventPayload) => {
      queryClient.setQueryData<MessageApiItem[]>(queryKeys.messages.list(activeThreadId), (current) =>
        upsertMessage(current, payload.message),
      );
      invalidateConversation();
    });

    channel.listen(".message.updated", (payload: MessageEventPayload) => {
      queryClient.setQueryData<MessageApiItem[]>(queryKeys.messages.list(activeThreadId), (current) =>
        upsertMessage(current, payload.message),
      );
      invalidateConversation();
    });

    channel.listen(".message.deleted", (payload: MessageEventPayload) => {
      queryClient.setQueryData<MessageApiItem[]>(queryKeys.messages.list(activeThreadId), (current) =>
        upsertMessage(current, payload.message),
      );
      invalidateConversation();
    });

    channel.listen(".reaction.changed", (payload: ReactionEventPayload) => {
      queryClient.setQueryData<MessageApiItem[]>(queryKeys.messages.list(activeThreadId), (current) =>
        (current ?? []).map((message) =>
          message.id === payload.message_id
            ? {
                ...message,
                reactions: payload.reactions ?? [],
              }
            : message,
        ),
      );
    });

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
