"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import {
  type ComposerAttachmentInput,
  type ComposerGifInput,
  type ComposerVoiceInput,
  type MessageApiItem,
  type MessageReactionApiItem,
  type StorageObjectApiItem,
} from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type MessageResponse = {
  data: MessageApiItem;
};

type StorageObjectResponse = {
  data: StorageObjectApiItem;
};

type ReactionResponse = {
  data: MessageReactionApiItem;
};

type SendMessagePayload = {
  conversationId: string;
  text: string;
  attachments: ComposerAttachmentInput[];
  voice: ComposerVoiceInput | null;
  gif: ComposerGifInput | null;
};

type EditMessagePayload = {
  conversationId: string;
  messageId: number;
  text: string;
};

type DeleteMessagePayload = {
  conversationId: string;
  messageId: number;
  scope: "self" | "everyone";
};

type ForwardMessagePayload = {
  sourceConversationId: string;
  targetConversationId: string;
  messageId: number;
};

async function uploadAttachment(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", "message_attachment");

  return apiClient.post<StorageObjectResponse>("/api/uploads", formData, {
    requiresCsrf: true,
  });
}

function invalidateMessageQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(conversationId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.sharedMedia(conversationId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.sharedFiles(conversationId) });
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, text, attachments, voice, gif }: SendMessagePayload) => {
      const normalizedText = text.trim();

      if (gif) {
        const response = await apiClient.post<MessageResponse>(
          `/api/conversations/${conversationId}/messages/gif`,
          {
            client_uuid: crypto.randomUUID(),
            gif_meta: {
              url: gif.url,
              title: gif.title ?? "GIF",
              preview_url: gif.previewUrl ?? gif.url,
              provider: gif.provider ?? "custom",
            },
          },
        );

        return response.data;
      }

      if (voice) {
        const uploadResponse = await uploadAttachment(voice.file);
        const response = await apiClient.post<MessageResponse>(
          `/api/conversations/${conversationId}/messages/voice`,
          {
            client_uuid: crypto.randomUUID(),
            storage_object_id: uploadResponse.data.id,
            duration_ms: voice.durationMs,
            waveform: [],
          },
        );

        return response.data;
      }

      if (attachments.length > 0) {
        const uploadResponses = await Promise.all(attachments.map((attachment) => uploadAttachment(attachment.file)));
        const response = await apiClient.post<MessageResponse>(
          `/api/conversations/${conversationId}/messages/media`,
          {
            client_uuid: crypto.randomUUID(),
            caption: normalizedText || null,
            storage_object_ids: uploadResponses.map((item) => item.data.id),
          },
        );

        return response.data;
      }

      const response = await apiClient.post<MessageResponse>(
        `/api/conversations/${conversationId}/messages/text`,
        {
          text: normalizedText,
          client_uuid: crypto.randomUUID(),
        },
      );

      return response.data;
    },
    onSuccess: (_, variables) => {
      invalidateMessageQueries(queryClient, variables.conversationId);
    },
  });
}

export function useToggleReactionMutation(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji, hasReacted }: { messageId: number; emoji: string; hasReacted: boolean }) => {
      if (hasReacted) {
        await apiClient.delete(`/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
        return null;
      }

      const response = await apiClient.post<ReactionResponse>(`/api/messages/${messageId}/reactions`, { emoji });
      return response.data;
    },
    onSuccess: () => {
      invalidateMessageQueries(queryClient, conversationId);
    },
  });
}

export function useEditMessageMutation(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, text }: EditMessagePayload) => {
      const response = await apiClient.patch<MessageResponse>(`/api/messages/${messageId}`, {
        text: text.trim(),
      });

      return response.data;
    },
    onSuccess: () => {
      invalidateMessageQueries(queryClient, conversationId);
    },
  });
}

export function useDeleteMessageMutation(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, scope }: DeleteMessagePayload) => {
      await apiClient.delete(`/api/messages/${messageId}`, {
        body: { scope },
      });
    },
    onSuccess: () => {
      invalidateMessageQueries(queryClient, conversationId);
    },
  });
}

export function useForwardMessageMutation(sourceConversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, targetConversationId }: ForwardMessagePayload) => {
      const response = await apiClient.post<MessageResponse>(`/api/messages/${messageId}/forward`, {
        target_conversation_id: Number(targetConversationId),
        client_uuid: crypto.randomUUID(),
      });

      return {
        data: response.data,
        targetConversationId,
      };
    },
    onSuccess: (_, variables) => {
      invalidateMessageQueries(queryClient, sourceConversationId);
      invalidateMessageQueries(queryClient, variables.targetConversationId);
    },
  });
}
