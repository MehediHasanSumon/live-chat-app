"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationUser } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type UsersResponse = {
  data: ConversationUser[];
};

export function useUserSearchQuery(query: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.search(query),
    queryFn: () =>
      apiClient.get<UsersResponse>(`/api/users/search?query=${encodeURIComponent(query)}`, {
        skipAuthRedirect: true,
      }),
    enabled: enabled && query.trim().length >= 2,
    retry: false,
    staleTime: 20_000,
    select: (response) => response.data,
  });
}
