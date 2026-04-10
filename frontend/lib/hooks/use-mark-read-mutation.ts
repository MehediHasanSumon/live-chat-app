"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type MarkReadPayload = {
  conversationId: string;
  lastSeq: number;
};

export function useMarkConversationReadMutation() {
  const queryClient = useQueryClient();

  const applyReadState = (conversation: ConversationApiItem, lastSeq: number): ConversationApiItem => ({
    ...conversation,
    membership: conversation.membership
      ? {
          ...conversation.membership,
          last_read_seq: Math.max(conversation.membership.last_read_seq, lastSeq),
          unread_count_cache: 0,
        }
      : conversation.membership,
  });

  const mapConversationList = (
    current: ConversationApiItem[] | { data?: ConversationApiItem[] } | undefined,
    updater: (conversation: ConversationApiItem) => ConversationApiItem,
  ) => {
    if (Array.isArray(current)) {
      return current.map(updater);
    }

    if (current && Array.isArray(current.data)) {
      return {
        ...current,
        data: current.data.map(updater),
      };
    }

    return current;
  };

  return useMutation({
    mutationFn: ({ conversationId, lastSeq }: MarkReadPayload) =>
      apiClient.post(
        `/api/conversations/${conversationId}/read`,
        {
          last_seq: lastSeq,
        },
        {
          headers: {
            "X-Skip-Debounce": "1",
          },
        },
      ),
    onMutate: async ({ conversationId, lastSeq }) => {
      queryClient.setQueryData<ConversationApiItem[] | { data?: ConversationApiItem[] } | undefined>(
        queryKeys.conversations.all,
        (current) =>
          mapConversationList(current, (conversation) =>
          String(conversation.id) === String(conversationId) ? applyReadState(conversation, lastSeq) : conversation,
          ),
      );

      queryClient.setQueryData<ConversationApiItem | undefined>(queryKeys.conversations.detail(conversationId), (current) =>
        current ? applyReadState(current, lastSeq) : current,
      );
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData<ConversationApiItem[] | { data?: ConversationApiItem[] } | undefined>(
        queryKeys.conversations.all,
        (current) =>
          mapConversationList(current, (conversation) =>
          String(conversation.id) === String(variables.conversationId)
            ? applyReadState(conversation, variables.lastSeq)
            : conversation,
          ),
      );

      queryClient.setQueryData<ConversationApiItem | undefined>(
        queryKeys.conversations.detail(variables.conversationId),
        (current) => (current ? applyReadState(current, variables.lastSeq) : current),
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}
