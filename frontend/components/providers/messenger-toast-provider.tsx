"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { type MessageApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";
import { connectEcho } from "@/lib/reverb";
import { useAuthStore } from "@/lib/stores/auth-store";
import { pushToast } from "@/lib/stores/toast-store";

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

export function MessengerToastProvider() {
  const queryClient = useQueryClient();
  const shownMessageIdsRef = useRef<Set<number>>(new Set());
  const authUserId = useAuthStore((state) => state.user?.id ?? null);

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

      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });

      if (conversationId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(conversationId) });
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
  }, [authUserId, queryClient]);

  return null;
}
