"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type ConversationResponse = {
  data: ConversationApiItem;
};

type SaveGroupPayload = {
  title?: string;
  avatarFile?: File | null;
  clearAvatar?: boolean;
};

function invalidateConversation(queryClient: ReturnType<typeof useQueryClient>, conversationId: number | string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
}

export function useSaveGroupConversationMutation(conversationId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, avatarFile, clearAvatar }: SaveGroupPayload) => {
      const formData = new FormData();

      if (typeof title === "string") {
        formData.append("title", title);
      }

      if (avatarFile) {
        formData.append("avatar_file", avatarFile);
      }

      if (clearAvatar) {
        formData.append("clear_avatar", "1");
      }

      const response = await apiClient.patch<ConversationResponse>(`/api/groups/${conversationId}`, formData);
      return response.data;
    },
    onSuccess: () => invalidateConversation(queryClient, conversationId),
  });
}
