"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type MessageAttachmentApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type SharedAttachmentsResponse = {
  data: MessageAttachmentApiItem[];
};

export function useSharedMediaQuery(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.conversations.sharedMedia(conversationId),
    queryFn: () =>
      apiClient.get<SharedAttachmentsResponse>(`/api/conversations/${conversationId}/shared-media`, {
        skipAuthRedirect: true,
      }),
    enabled: enabled && Boolean(conversationId),
    retry: false,
    select: (response) => response.data,
  });
}

export function useSharedFilesQuery(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.conversations.sharedFiles(conversationId),
    queryFn: () =>
      apiClient.get<SharedAttachmentsResponse>(`/api/conversations/${conversationId}/shared-files`, {
        skipAuthRedirect: true,
      }),
    enabled: enabled && Boolean(conversationId),
    retry: false,
    select: (response) => response.data,
  });
}
