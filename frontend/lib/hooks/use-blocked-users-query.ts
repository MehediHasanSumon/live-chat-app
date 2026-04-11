"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationUser } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

export type BlockedUserApiItem = {
  id: number;
  blocker_user_id: number;
  blocked_user_id: number;
  block_chat: boolean;
  block_call: boolean;
  hide_presence: boolean;
  created_at: string;
  blocked_user?: ConversationUser | null;
};

type BlockedUsersResponse = {
  data: BlockedUserApiItem[];
};

export function useBlockedUsersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.blocked,
    queryFn: () => apiClient.get<BlockedUsersResponse>("/api/blocked-users", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}
