"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";
import { isRealtimeConfigured } from "@/lib/reverb";

export type ConversationsResponse = {
  data: ConversationApiItem[];
  meta?: {
    total_unread_count?: number;
  };
};

export type ConversationListFilter = "all" | "unread" | "groups" | "online";

const realtimeConfigured = isRealtimeConfigured();

function getConversationsQueryOptions(enabled: boolean, filter: ConversationListFilter) {
  return {
    queryKey: queryKeys.conversations.list(filter),
    queryFn: () =>
      apiClient.get<ConversationsResponse>(`/api/conversations?filter=${filter}`, {
        skipAuthRedirect: true,
      }),
    enabled,
    retry: false,
    staleTime: realtimeConfigured ? 30_000 : 10_000,
    refetchInterval: realtimeConfigured ? false : 15_000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  } as const;
}

export function useConversationsResponseQuery(enabled = true, filter: ConversationListFilter = "all") {
  return useQuery(getConversationsQueryOptions(enabled, filter));
}

export function useConversationsQuery(enabled = true, filter: ConversationListFilter = "all") {
  return useQuery({
    ...getConversationsQueryOptions(enabled, filter),
    select: (response: ConversationsResponse) => response.data,
  });
}
