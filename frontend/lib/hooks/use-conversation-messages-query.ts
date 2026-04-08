"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type MessageApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type ConversationMessagesResponse = {
  data: MessageApiItem[];
  meta: {
    next_cursor: number | null;
  };
};

export function useConversationMessagesQuery(conversationId: string) {
  return useQuery({
    queryKey: queryKeys.messages.list(conversationId),
    queryFn: () =>
      apiClient.get<ConversationMessagesResponse>(`/api/conversations/${conversationId}/messages`, {
        skipAuthRedirect: true,
      }),
    enabled: Boolean(conversationId),
    retry: false,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    select: (response) => response.data,
  });
}
