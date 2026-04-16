"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";
import { isRealtimeConfigured } from "@/lib/reverb";

type ConversationResponse = {
  data: ConversationApiItem;
};

const realtimeConfigured = isRealtimeConfigured();

export function useConversationQuery(conversationId: string) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(conversationId),
    queryFn: () =>
      apiClient.get<ConversationResponse>(`/api/conversations/${conversationId}`, {
        skipAuthRedirect: true,
      }),
    enabled: Boolean(conversationId),
    retry: 1,
    staleTime: realtimeConfigured ? 30_000 : 10_000,
    refetchInterval: realtimeConfigured ? false : 10_000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    select: (response) => response.data,
  });
}
