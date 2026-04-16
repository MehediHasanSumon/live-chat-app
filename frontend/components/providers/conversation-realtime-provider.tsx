"use client";

import { useEffect } from "react";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";

import {
  type ConversationApiItem,
  type MessageApiItem,
  type MessageReactionApiItem,
} from "@/lib/messages-data";
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

type MessageChangedPayload = {
  message: MessageApiItem;
};

type ReactionChangedPayload = {
  message_id: number;
  reactions: MessageReactionApiItem[];
};

type ConversationReadPayload = {
  conversation_id: number;
  user_id: number;
  last_read_seq: number;
  conversation: ConversationApiItem;
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

  const shouldRefreshPreview =
    conversation.last_message_id === message.id || (conversation.last_message_seq ?? 0) <= message.seq;

  if (!shouldRefreshPreview) {
    return conversation;
  }

  return {
    ...conversation,
    last_message_seq: Math.max(conversation.last_message_seq ?? 0, message.seq),
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

    const patchConversationSnapshot = (conversation: ConversationApiItem) => {
      queryClient.setQueriesData<ConversationsResponse>({ queryKey: queryKeys.conversations.lists }, (current) => {
        if (!current?.data) {
          return current;
        }

        return {
          ...current,
          data: current.data.map((item) => (String(item.id) === String(conversation.id) ? conversation : item)),
        };
      });

      queryClient.setQueryData<ConversationDetailCache>(queryKeys.conversations.detail(conversation.id), (current) => {
        if (!current) {
          return current;
        }

        if (!("data" in current)) {
          return conversation;
        }

        return {
          ...current,
          data: conversation,
        };
      });
    };

    const patchConversationMessage = (message: MessageApiItem) => {
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
    };

    const upsertMessage = (message: MessageApiItem, mode: "create" | "update") => {
      patchConversationMessage(message);

      queryClient.setQueryData<InfiniteData<ConversationMessagesResponse, number | null>>(
        queryKeys.messages.list(activeThreadId),
        (current) => {
          if (!current?.pages?.length) {
            return current;
          }

          let foundExisting = false;

          const pages = current.pages.map((page, index) => {
            const existingIndex = page.data.findIndex((item) => item.id === message.id);

            if (existingIndex >= 0) {
              foundExisting = true;

              return {
                ...page,
                data: page.data.map((item) => (item.id === message.id ? message : item)),
              };
            }

            if (mode === "create" && index === 0) {
              return {
                ...page,
                data: [...page.data, message].sort((left, right) => left.seq - right.seq),
              };
            }

            return page;
          });

          if (mode === "update" && !foundExisting) {
            return current;
          }

          return {
            ...current,
            pages,
          };
        },
      );
    };

    const patchMessageReactions = (messageId: number, reactions: MessageReactionApiItem[]) => {
      queryClient.setQueryData<InfiniteData<ConversationMessagesResponse, number | null>>(
        queryKeys.messages.list(activeThreadId),
        (current) => {
          if (!current?.pages?.length) {
            return current;
          }

          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              data: page.data.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      reactions,
                    }
                  : message,
              ),
            })),
          };
        },
      );
    };

    const handleMessageCreated = (payload: MessageChangedPayload) => {
      if (!payload.message || String(payload.message.conversation_id) !== activeThreadId) {
        return;
      }

      upsertMessage(payload.message, "create");
    };

    const handleMessageUpdated = (payload: MessageChangedPayload) => {
      if (!payload.message || String(payload.message.conversation_id) !== activeThreadId) {
        return;
      }

      upsertMessage(payload.message, "update");
    };

    const handleMessageDeleted = (payload: MessageChangedPayload) => {
      if (!payload.message || String(payload.message.conversation_id) !== activeThreadId) {
        return;
      }

      upsertMessage(payload.message, "update");
    };

    const handleReactionChanged = (payload: ReactionChangedPayload) => {
      patchMessageReactions(payload.message_id, payload.reactions);
    };

    const handleConversationRead = (payload: ConversationReadPayload) => {
      patchConversationSnapshot(payload.conversation);
    };

    const channel = echo.private(`conversation.${activeThreadId}`);
    const presenceChannel = echo.join(`conversation.${activeThreadId}`);

    channel.listen(".message.created", handleMessageCreated);
    channel.listen(".message.updated", handleMessageUpdated);
    channel.listen(".message.deleted", handleMessageDeleted);
    channel.listen(".reaction.changed", handleReactionChanged);
    channel.listen(".conversation.read", handleConversationRead);

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
