"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type MessageApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

export type ConversationMessagesResponse = {
  data: MessageApiItem[];
  meta: {
    next_cursor: number | null;
  };
};

export function useConversationMessagesQuery(conversationId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages.list(conversationId),
    queryFn: ({ pageParam }) =>
      apiClient.get<ConversationMessagesResponse>(`/api/conversations/${conversationId}/messages`, {
        skipAuthRedirect: true,
        query: {
          limit: 10,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor,
    enabled: Boolean(conversationId),
    retry: false,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      messages: data.pages
        .slice()
        .reverse()
        .flatMap((page) => page.data),
      nextCursor: data.pages.at(-1)?.meta.next_cursor ?? null,
    }),
  });
}
