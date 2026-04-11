"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type ConversationsResponse = {
  data: ConversationApiItem[];
};

export type ConversationListFilter = "all" | "unread" | "groups" | "online";

export function useConversationsQuery(
  enabled = true,
  filter: ConversationListFilter = "all",
) {
  return useQuery({
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
    select: (response) => response.data,
  });
}
