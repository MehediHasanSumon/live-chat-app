"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import {
  type CallRoomApiItem,
  type JoinCallApiPayload,
  getDirectCallTargetUserId,
} from "@/lib/calls-data";
import { type MessageThread } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";
import { useCallStore } from "@/lib/stores/call-store";

type CallRoomResponse = {
  data: CallRoomApiItem;
};

type JoinTokenResponse = {
  data: JoinCallApiPayload;
};

type StartCallPayload = {
  thread: MessageThread;
  mediaType: "voice" | "video";
  authUserId: number;
};

type JoinCallPayload = {
  roomUuid: string;
  wantsVideo?: boolean;
};

function invalidateCallQueries(queryClient: ReturnType<typeof useQueryClient>, conversationId: number | string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
}

export function useStartCallMutation() {
  const queryClient = useQueryClient();
  const setOutgoingCall = useCallStore((state) => state.setOutgoingCall);

  return useMutation({
    mutationFn: async ({ thread, mediaType, authUserId }: StartCallPayload) => {
      if (thread.isGroup) {
        return apiClient
          .post<CallRoomResponse>(`/api/conversations/${thread.id}/calls/group/${mediaType}`)
          .then((response) => response.data);
      }

      const targetUserId = getDirectCallTargetUserId(thread, authUserId);

      if (!targetUserId) {
        throw new Error("We could not identify the other participant for this call.");
      }

      return apiClient
        .post<CallRoomResponse>(`/api/calls/direct/${targetUserId}/${mediaType}`)
        .then((response) => response.data);
    },
    onSuccess: (callRoom) => {
      setOutgoingCall(callRoom);
      invalidateCallQueries(queryClient, callRoom.conversation_id);
    },
  });
}

export function useAcceptCallMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomUuid: string) =>
      apiClient.post<CallRoomResponse>(`/api/calls/${roomUuid}/accept`).then((response) => response.data),
    onSuccess: (callRoom) => {
      invalidateCallQueries(queryClient, callRoom.conversation_id);
    },
  });
}

export function useDeclineCallMutation() {
  const queryClient = useQueryClient();
  const clearIncomingCall = useCallStore((state) => state.clearIncomingCall);
  const clearActiveCall = useCallStore((state) => state.clearActiveCall);

  return useMutation({
    mutationFn: async (roomUuid: string) =>
      apiClient.post<CallRoomResponse>(`/api/calls/${roomUuid}/decline`).then((response) => response.data),
    onSuccess: (callRoom) => {
      clearIncomingCall();
      clearActiveCall();
      invalidateCallQueries(queryClient, callRoom.conversation_id);
    },
  });
}

export function useEndCallMutation() {
  const queryClient = useQueryClient();
  const clearActiveCall = useCallStore((state) => state.clearActiveCall);

  return useMutation({
    mutationFn: async ({ roomUuid, reason }: { roomUuid: string; reason?: string }) =>
      apiClient
        .post<CallRoomResponse>(`/api/calls/${roomUuid}/end`, reason ? { reason } : undefined)
        .then((response) => response.data),
    onSuccess: (callRoom) => {
      clearActiveCall();
      invalidateCallQueries(queryClient, callRoom.conversation_id);
    },
  });
}

export function useJoinCallMutation() {
  const queryClient = useQueryClient();
  const setJoinedCall = useCallStore((state) => state.setJoinedCall);

  return useMutation({
    mutationFn: async ({ roomUuid, wantsVideo = false }: JoinCallPayload) =>
      apiClient
        .post<JoinTokenResponse>(`/api/calls/${roomUuid}/join-token`, {
          wants_video: wantsVideo,
        })
        .then((response) => response.data),
    onSuccess: (payload) => {
      setJoinedCall(payload);
      invalidateCallQueries(queryClient, payload.call_room.conversation_id);
    },
  });
}
