"use client";

import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

type TypingPayload = {
  conversationId: string;
  deviceUuid?: string;
};

export function useStartTypingMutation() {
  return useMutation({
    mutationFn: ({ conversationId, deviceUuid }: TypingPayload) =>
      apiClient.post(`/api/conversations/${conversationId}/typing`, {
        ...(deviceUuid ? { device_uuid: deviceUuid } : {}),
      }),
    retry: false,
  });
}

export function useStopTypingMutation() {
  return useMutation({
    mutationFn: ({ conversationId, deviceUuid }: TypingPayload) =>
      apiClient.delete(`/api/conversations/${conversationId}/typing`, {
        body: JSON.stringify(deviceUuid ? { device_uuid: deviceUuid } : {}),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    retry: false,
  });
}
