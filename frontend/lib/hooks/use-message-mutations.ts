"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import {
  type ComposerAttachmentInput,
  type MessageApiItem,
  type StorageObjectApiItem,
} from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type MessageResponse = {
  data: MessageApiItem;
};

type StorageObjectResponse = {
  data: StorageObjectApiItem;
};

type SendMessagePayload = {
  conversationId: string;
  text: string;
  attachments: ComposerAttachmentInput[];
};

async function uploadAttachment(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", "message_attachment");

  return apiClient.post<StorageObjectResponse>("/api/uploads", formData, {
    requiresCsrf: true,
  });
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, text, attachments }: SendMessagePayload) => {
      const normalizedText = text.trim();
      const fallbackText = attachments.length > 0 ? "Shared an attachment" : "";
      const messageResponse = await apiClient.post<MessageResponse>(
        `/api/conversations/${conversationId}/messages/text`,
        {
          text: normalizedText || fallbackText,
          client_uuid: crypto.randomUUID(),
        },
      );

      if (attachments.length > 0) {
        for (const [index, attachment] of attachments.entries()) {
          const uploadResponse = await uploadAttachment(attachment.file);

          await apiClient.post(`/api/uploads/${uploadResponse.data.id}/attach`, {
            message_id: messageResponse.data.id,
            display_order: index + 1,
          });
        }
      }

      return messageResponse.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}
