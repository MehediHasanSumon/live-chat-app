"use client";

import { useConversationsResponseQuery } from "@/lib/hooks/use-conversations-query";

export function useMessagesBadgeCount(enabled = true) {
  const { data, isLoading, isError } = useConversationsResponseQuery(enabled, "all");
  const badgeCount = Math.max(0, data?.meta?.total_unread_count ?? 0);

  return {
    badgeCount,
    isLoading,
    isError,
  };
}
