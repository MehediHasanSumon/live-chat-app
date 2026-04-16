"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { type ConversationApiItem, type MessageApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";
import { connectEcho } from "@/lib/reverb";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { pushToast } from "@/lib/stores/toast-store";

type ConversationsCache = ConversationApiItem[] | { data?: ConversationApiItem[] } | undefined;
type ConversationDetailCache = ConversationApiItem | { data: ConversationApiItem } | undefined;

type NotificationPayload = {
  notification_id?: number;
  message_id?: number;
  conversation_id?: number;
  sender_id?: number;
  message?: MessageApiItem;
  title?: string;
  body?: string;
  type?: "new_message" | "request" | "summary" | string;
};

function payloadConversationId(payload: NotificationPayload) {
  return payload.conversation_id ? String(payload.conversation_id) : payload.message?.conversation_id ? String(payload.message.conversation_id) : null;
}

function payloadMessageId(payload: NotificationPayload) {
  return payload.message_id ?? payload.message?.id ?? payload.notification_id ?? null;
}

function payloadSenderId(payload: NotificationPayload) {
  return payload.sender_id ?? payload.message?.sender_id ?? null;
}

function payloadTitle(payload: NotificationPayload) {
  return payload.title ?? payload.message?.sender?.name ?? "New message";
}

function payloadBody(payload: NotificationPayload) {
  return payload.body ?? payload.message?.display_text ?? payload.message?.text_body ?? "Sent you a message.";
}

function buildConversationPreview(message: MessageApiItem): string {
  if (message.display_text?.trim()) {
    return message.display_text.trim();
  }

  if (message.text_body?.trim()) {
    return message.text_body.trim();
  }

  return "New message";
}

export function MessengerToastProvider() {
  const queryClient = useQueryClient();
  const shownMessageIdsRef = useRef<Set<number>>(new Set());
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const activeThreadId = useChatUiStore((state) => state.activeThreadId);

  useEffect(() => {
    if (!authUserId) {
      return;
    }

    const echo = connectEcho();

    if (!echo) {
      return;
    }

    const userChannel = echo.private(`user.${authUserId}`);

    const handleMessageNotification = (payload: NotificationPayload) => {
      const conversationId = payloadConversationId(payload);
      const messageId = payloadMessageId(payload);

      if (payload.message && conversationId) {
        const message = payload.message;
        const isActiveConversation = activeThreadId === conversationId;
        const patchConversation = (conversation: ConversationApiItem): ConversationApiItem => {
          if (String(conversation.id) !== conversationId) {
            return conversation;
          }

          return {
            ...conversation,
            last_message_seq: Math.max(conversation.last_message_seq ?? 0, message.seq),
            last_message_id: message.id,
            last_message_preview: buildConversationPreview(message),
            last_message_at: message.created_at,
            updated_at: message.updated_at,
            membership: conversation.membership
              ? {
                  ...conversation.membership,
                  unread_count_cache: isActiveConversation ? 0 : conversation.membership.unread_count_cache + 1,
                }
              : conversation.membership,
          };
        };

        queryClient.setQueriesData<ConversationsCache>({ queryKey: queryKeys.conversations.lists }, (current) => {
          if (Array.isArray(current)) {
            return current.map(patchConversation);
          }

          if (current?.data) {
            return {
              ...current,
              data: current.data.map(patchConversation),
            };
          }

          return current;
        });

        queryClient.setQueryData<ConversationDetailCache>(queryKeys.conversations.detail(conversationId), (current) => {
          if (!current) {
            return current;
          }

          if ("data" in current) {
            return {
              ...current,
              data: patchConversation(current.data),
            };
          }

          return patchConversation(current);
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      }

      if (!conversationId || payload.type === "summary" || payloadSenderId(payload) === authUserId) {
        return;
      }

      if (messageId && shownMessageIdsRef.current.has(messageId)) {
        return;
      }

      if (messageId) {
        shownMessageIdsRef.current.add(messageId);
      }

      pushToast({
        id: messageId ? `message-${messageId}` : undefined,
        kind: "message",
        tone: "message",
        title: payloadTitle(payload),
        senderName: payloadTitle(payload),
        message: payloadBody(payload),
        conversationId,
      });
    };

    userChannel.listen(".message.created", handleMessageNotification);
    userChannel.listen(".notification.badge.updated", handleMessageNotification);
    userChannel.listen(".conversation.request.created", handleMessageNotification);

    return () => {
      userChannel.stopListening(".message.created");
      userChannel.stopListening(".notification.badge.updated");
      userChannel.stopListening(".conversation.request.created");
    };
  }, [activeThreadId, authUserId, queryClient]);

  return null;
}
