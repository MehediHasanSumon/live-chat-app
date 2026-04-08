"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type ConversationResponse = {
  data: ConversationApiItem;
};

function invalidateConversation(queryClient: ReturnType<typeof useQueryClient>, conversationId: number | string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
}

export function useAddGroupMembersMutation(conversationId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberIds: number[]) =>
      apiClient.post<ConversationResponse>(`/api/groups/${conversationId}/members`, { member_ids: memberIds }),
    onSuccess: () => invalidateConversation(queryClient, conversationId),
  });
}

export function useRemoveGroupMemberMutation(conversationId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) =>
      apiClient.delete<ConversationResponse>(`/api/groups/${conversationId}/members/${userId}`),
    onSuccess: () => invalidateConversation(queryClient, conversationId),
  });
}

export function useChangeGroupRoleMutation(conversationId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: "admin" | "member" }) =>
      apiClient.patch<ConversationResponse>(`/api/groups/${conversationId}/members/${userId}/role`, { role }),
    onSuccess: () => invalidateConversation(queryClient, conversationId),
  });
}

export function useLeaveGroupMutation(conversationId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<ConversationResponse>(`/api/groups/${conversationId}/leave`),
    onSuccess: () => {
      invalidateConversation(queryClient, conversationId);
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}
