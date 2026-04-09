"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type MarkReadPayload = {
  conversationId: string;
  lastSeq: number;
};

export function useMarkConversationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, lastSeq }: MarkReadPayload) =>
      apiClient.post(`/api/conversations/${conversationId}/read`, {
        last_seq: lastSeq,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}
