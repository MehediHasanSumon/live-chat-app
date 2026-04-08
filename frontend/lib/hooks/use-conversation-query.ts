"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type ConversationResponse = {
  data: ConversationApiItem;
};

export function useConversationQuery(conversationId: string) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(conversationId),
    queryFn: () =>
      apiClient.get<ConversationResponse>(`/api/conversations/${conversationId}`, {
        skipAuthRedirect: true,
      }),
    enabled: Boolean(conversationId),
    retry: false,
    staleTime: 10_000,
    select: (response) => response.data,
  });
}
