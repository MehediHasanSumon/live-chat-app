"use client";

import { useQuery, useQueries } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type MessageThread, type UserPresenceApiItem, getDirectThreadPeer } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type UserPresenceResponse = {
  data: UserPresenceApiItem;
};

async function fetchUserPresence(userId: number) {
  const response = await apiClient.get<UserPresenceResponse>(`/api/users/${userId}/presence`, {
    skipAuthRedirect: true,
  });

  return response.data;
}

export function useUserPresenceQuery(userId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.presence(userId ?? "guest"),
    queryFn: () => fetchUserPresence(userId as number),
    enabled: enabled && Boolean(userId),
    retry: false,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useConversationPresenceMap(threads: MessageThread[]) {
  const directTargets = threads
    .map((thread) => {
      const peer = getDirectThreadPeer(thread);

      if (!peer?.user_id) {
        return null;
      }

      return {
        conversationId: thread.id,
        userId: peer.user_id,
      };
    })
    .filter((item): item is { conversationId: string; userId: number } => item !== null);

  const results = useQueries({
    queries: directTargets.map((target) => ({
      queryKey: queryKeys.users.presence(target.userId),
      queryFn: () => fetchUserPresence(target.userId),
      retry: false,
      staleTime: 15_000,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    })),
  });

  return directTargets.reduce<Record<string, UserPresenceApiItem>>((accumulator, target, index) => {
    const payload = results[index]?.data;

    if (payload) {
      accumulator[target.conversationId] = payload;
    }

    return accumulator;
  }, {});
}
