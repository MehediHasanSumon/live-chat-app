"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type ConversationResponse = {
  data: ConversationApiItem;
};

export function useAcceptMessageRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: number) =>
      apiClient.post<ConversationResponse>(`/api/message-requests/${conversationId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.requests });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useRejectMessageRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: number) =>
      apiClient.post<ConversationResponse>(`/api/message-requests/${conversationId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.requests });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}
