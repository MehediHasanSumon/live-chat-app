"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

type TypingUser = {
  id: number;
  name: string;
};

type TypingUsersResponse = {
  data: TypingUser[];
};

export function useTypingUsersQuery(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: ["typing", conversationId],
    queryFn: () =>
      apiClient.get<TypingUsersResponse>(`/api/conversations/${conversationId}/typing`, {
        skipAuthRedirect: true,
      }),
    enabled: enabled && Boolean(conversationId),
    retry: false,
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    select: (response) => response.data,
  });
}
