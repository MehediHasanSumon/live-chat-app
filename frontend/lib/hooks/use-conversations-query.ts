"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

export type ConversationsResponse = {
  data: ConversationApiItem[];
  meta?: {
    total_unread_count?: number;
  };
};

export type ConversationListFilter = "all" | "unread" | "groups" | "online";

function getConversationsQueryOptions(enabled: boolean, filter: ConversationListFilter) {
  return {
    queryKey: queryKeys.conversations.list(filter),
    queryFn: () =>
      apiClient.get<ConversationsResponse>(`/api/conversations?filter=${filter}`, {
        skipAuthRedirect: true,
      }),
    enabled,
    retry: false,
    staleTime: 10_000,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
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
