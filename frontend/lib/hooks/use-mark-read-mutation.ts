"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type MarkReadPayload = {
  conversationId: string;
  lastSeq: number;
};

type ConversationsCache = ConversationApiItem[] | { data?: ConversationApiItem[] } | undefined;
type ConversationDetailCache = ConversationApiItem | { data: ConversationApiItem } | undefined;

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
      queryClient.setQueriesData<ConversationsCache>(
        { queryKey: queryKeys.conversations.lists },
        (current) =>
          mapConversationList(current, (conversation) =>
          String(conversation.id) === String(conversationId) ? applyReadState(conversation, lastSeq) : conversation,
          ),
      );

      queryClient.setQueryData<ConversationDetailCache>(queryKeys.conversations.detail(conversationId), (current) => {
        if (!current) {
          return current;
        }

        if ("data" in current) {
          return {
            ...current,
            data: applyReadState(current.data, lastSeq),
          };
        }

        return applyReadState(current, lastSeq);
      });
    },
    onSuccess: (_, variables) => {
      queryClient.setQueriesData<ConversationsCache>(
        { queryKey: queryKeys.conversations.lists },
        (current) =>
          mapConversationList(current, (conversation) =>
          String(conversation.id) === String(variables.conversationId)
            ? applyReadState(conversation, variables.lastSeq)
            : conversation,
          ),
      );

      queryClient.setQueryData<ConversationDetailCache>(
        queryKeys.conversations.detail(variables.conversationId),
        (current) => {
          if (!current) {
            return current;
          }

          if ("data" in current) {
            return {
              ...current,
              data: applyReadState(current.data, variables.lastSeq),
            };
          }

          return applyReadState(current, variables.lastSeq);
        },
      );
    },
  });
}
