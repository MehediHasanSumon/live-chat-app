"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { isRealtimeConfigured } from "@/lib/reverb";

type TypingUser = {
  id: number;
  name: string;
};

type TypingUsersResponse = {
  data: TypingUser[];
};

const realtimeConfigured = isRealtimeConfigured();

export function useTypingUsersQuery(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: ["typing", conversationId],
    queryFn: () =>
      apiClient.get<TypingUsersResponse>(`/api/conversations/${conversationId}/typing`, {
        skipAuthRedirect: true,
      }),
    enabled: enabled && Boolean(conversationId),
    retry: false,
    staleTime: realtimeConfigured ? 5_000 : 0,
    refetchInterval: realtimeConfigured ? false : 3_000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    select: (response) => response.data,
  });
}
