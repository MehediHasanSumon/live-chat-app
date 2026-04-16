"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { buildCallDevicePayload, ensureCallLaunchDeviceReadiness } from "@/lib/call-device";
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

async function resolveCallDevicePayload(requestedMediaType: "voice" | "video") {
  const snapshot = await ensureCallLaunchDeviceReadiness({
    requestedMediaType,
  });

  return buildCallDevicePayload(snapshot);
}

function invalidateCallQueries(queryClient: ReturnType<typeof useQueryClient>, conversationId: number | string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
}

export function useStartCallMutation() {
  const queryClient = useQueryClient();
  const setOutgoingCall = useCallStore((state) => state.setOutgoingCall);

  return useMutation({
    mutationFn: async ({ thread, mediaType, authUserId }: StartCallPayload) => {
      const devicePayload = await resolveCallDevicePayload(mediaType);

      if (thread.isGroup) {
        return apiClient
          .post<CallRoomResponse>(`/api/conversations/${thread.id}/calls/group/${mediaType}`, devicePayload)
          .then((response) => response.data);
      }

      const targetUserId = getDirectCallTargetUserId(thread, authUserId);

      if (!targetUserId) {
        throw new Error("We could not identify the other participant for this call.");
      }

      return apiClient
        .post<CallRoomResponse>(`/api/calls/direct/${targetUserId}/${mediaType}`, devicePayload)
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
    mutationFn: async (roomUuid: string) => {
      const devicePayload = await resolveCallDevicePayload("voice");

      return apiClient
        .post<CallRoomResponse>(`/api/calls/${roomUuid}/accept`, devicePayload)
        .then((response) => response.data);
    },
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

export function useEndCallForAllMutation() {
  const queryClient = useQueryClient();
  const clearActiveCall = useCallStore((state) => state.clearActiveCall);

  return useMutation({
    mutationFn: async ({ roomUuid, reason }: { roomUuid: string; reason?: string }) =>
      apiClient
        .post<CallRoomResponse>(`/api/calls/${roomUuid}/end-for-all`, reason ? { reason } : undefined)
        .then((response) => response.data),
    onSuccess: (callRoom) => {
      clearActiveCall();
      invalidateCallQueries(queryClient, callRoom.conversation_id);
    },
  });
}

export function useLockCallRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomUuid: string) =>
      apiClient.post<CallRoomResponse>(`/api/calls/${roomUuid}/lock`).then((response) => response.data),
    onSuccess: (callRoom) => {
      invalidateCallQueries(queryClient, callRoom.conversation_id);
    },
  });
}

export function useUnlockCallRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomUuid: string) =>
      apiClient.post<CallRoomResponse>(`/api/calls/${roomUuid}/unlock`).then((response) => response.data),
    onSuccess: (callRoom) => {
      invalidateCallQueries(queryClient, callRoom.conversation_id);
    },
  });
}

export function useRemoveCallParticipantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomUuid,
      userId,
      reason,
    }: {
      roomUuid: string;
      userId: number;
      reason?: string;
    }) =>
      apiClient
        .post<CallRoomResponse>(
          `/api/calls/${roomUuid}/participants/${userId}/remove`,
          reason ? { reason } : undefined,
        )
        .then((response) => response.data),
    onSuccess: (callRoom) => {
      invalidateCallQueries(queryClient, callRoom.conversation_id);
    },
  });
}

export function useMuteAllCallParticipantsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomUuid: string) =>
      apiClient.post<CallRoomResponse>(`/api/calls/${roomUuid}/mute-all`).then((response) => response.data),
    onSuccess: (callRoom) => {
      invalidateCallQueries(queryClient, callRoom.conversation_id);
    },
  });
}

export function useInviteCallParticipantsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomUuid,
      userIds,
    }: {
      roomUuid: string;
      userIds: number[];
    }) =>
      apiClient
        .post<CallRoomResponse>(`/api/calls/${roomUuid}/invite`, {
          user_ids: userIds,
        })
        .then((response) => response.data),
    onSuccess: (callRoom) => {
      invalidateCallQueries(queryClient, callRoom.conversation_id);
    },
  });
}

export function useJoinCallMutation() {
  const queryClient = useQueryClient();
  const setJoinedCall = useCallStore((state) => state.setJoinedCall);

  return useMutation({
    mutationFn: async ({ roomUuid, wantsVideo = false }: JoinCallPayload) =>
      resolveCallDevicePayload(wantsVideo ? "video" : "voice").then((devicePayload) =>
        apiClient
          .post<JoinTokenResponse>(`/api/calls/${roomUuid}/join-token`, {
            wants_video: wantsVideo,
            ...devicePayload,
          })
          .then((response) => response.data),
      ),
    onSuccess: (payload) => {
      setJoinedCall(payload);
      invalidateCallQueries(queryClient, payload.call_room.conversation_id);
    },
  });
}
