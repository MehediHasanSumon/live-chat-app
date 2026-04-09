"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type ConversationsResponse = {
  data: ConversationApiItem[];
};

export function useConversationsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.conversations.all,
    queryFn: () =>
      apiClient.get<ConversationsResponse>("/api/conversations", {
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
