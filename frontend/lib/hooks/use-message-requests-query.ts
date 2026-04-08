"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type MessageRequestsResponse = {
  data: ConversationApiItem[];
};

export function useMessageRequestsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.conversations.requests,
    queryFn: () => apiClient.get<MessageRequestsResponse>("/api/message-requests", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}
