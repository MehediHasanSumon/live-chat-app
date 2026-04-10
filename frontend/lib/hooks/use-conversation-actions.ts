"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type ConversationResponse = {
  data: ConversationApiItem;
};

type UserBlockResponse = {
  data: {
    blocked_user_id: number;
  };
};

function updateConversationList(
  conversations: ConversationApiItem[] | undefined,
  conversationId: string | number,
  updater: (conversation: ConversationApiItem) => ConversationApiItem | null,
) {
  if (!conversations) {
    return conversations;
  }

  return conversations.flatMap((conversation) => {
    if (String(conversation.id) !== String(conversationId)) {
      return [conversation];
    }

    const updated = updater(conversation);
    return updated ? [updated] : [];
  });
}

function setConversationInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  conversation: ConversationApiItem,
) {
  queryClient.setQueryData<ConversationApiItem[] | undefined>(queryKeys.conversations.all, (current) =>
    updateConversationList(current, conversation.id, () => conversation),
  );
  queryClient.setQueryData(queryKeys.conversations.detail(conversation.id), conversation);
}

function patchConversationInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string | number,
  updater: (conversation: ConversationApiItem) => ConversationApiItem | null,
) {
  queryClient.setQueryData<ConversationApiItem[] | undefined>(queryKeys.conversations.all, (current) =>
    updateConversationList(current, conversationId, updater),
  );
  queryClient.setQueryData<ConversationApiItem | undefined>(queryKeys.conversations.detail(conversationId), (current) =>
    current ? updater(current) ?? current : current,
  );
}

function invalidateConversation(queryClient: ReturnType<typeof useQueryClient>, conversationId: string | number) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
}

export function useMarkConversationUnreadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string | number) =>
      apiClient.post<ConversationResponse>(`/api/conversations/${conversationId}/unread`),
    onMutate: async (conversationId) => {
      patchConversationInCache(queryClient, conversationId, (conversation) => ({
        ...conversation,
        membership: conversation.membership
          ? {
              ...conversation.membership,
              last_read_seq:
                conversation.last_message_seq > 0
                  ? Math.min(conversation.membership.last_read_seq, conversation.last_message_seq - 1)
                  : conversation.membership.last_read_seq,
              unread_count_cache:
                conversation.last_message_seq > 0
                  ? Math.max(conversation.membership.unread_count_cache, 1)
                  : conversation.membership.unread_count_cache,
              archived_at: null,
            }
          : conversation.membership,
      }));
    },
    onSuccess: (response) => {
      setConversationInCache(queryClient, response.data);
    },
    onError: (_, conversationId) => {
      invalidateConversation(queryClient, conversationId);
    },
  });
}

export function useSetConversationMuteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      mutedUntil,
    }: {
      conversationId: string | number;
      mutedUntil: string | null;
    }) =>
      apiClient.patch<ConversationResponse>(`/api/conversations/${conversationId}/mute`, {
        muted_until: mutedUntil,
      }),
    onMutate: async ({ conversationId, mutedUntil }) => {
      patchConversationInCache(queryClient, conversationId, (conversation) => ({
        ...conversation,
        membership: conversation.membership
          ? {
              ...conversation.membership,
              muted_until: mutedUntil,
            }
          : conversation.membership,
      }));
    },
    onSuccess: (response) => {
      setConversationInCache(queryClient, response.data);
    },
    onError: (_, variables) => {
      invalidateConversation(queryClient, variables.conversationId);
    },
  });
}

export function useArchiveConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string | number) =>
      apiClient.patch<ConversationResponse>(`/api/conversations/${conversationId}/archive`),
    onMutate: async (conversationId) => {
      patchConversationInCache(queryClient, conversationId, () => null);
    },
    onSuccess: (response) => {
      queryClient.setQueryData<ConversationApiItem[] | undefined>(queryKeys.conversations.all, (current) =>
        updateConversationList(current, response.data.id, () => null),
      );
      queryClient.setQueryData(queryKeys.conversations.detail(response.data.id), response.data);
    },
    onError: (_, conversationId) => {
      invalidateConversation(queryClient, conversationId);
    },
  });
}

export function useBlockConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
    }: {
      conversationId: string | number;
      userId: number;
    }) => apiClient.post<UserBlockResponse>(`/api/users/${userId}/block`),
    onMutate: async ({ conversationId }) => {
      patchConversationInCache(queryClient, conversationId, () => null);
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData<ConversationApiItem[] | undefined>(queryKeys.conversations.all, (current) =>
        updateConversationList(current, variables.conversationId, () => null),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.presence(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(variables.conversationId) });
    },
    onError: (_, variables) => {
      invalidateConversation(queryClient, variables.conversationId);
    },
  });
}
