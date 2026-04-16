"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type AuthMeResponse } from "@/lib/hooks/use-auth-me-query";
import { queryKeys } from "@/lib/query-keys";

type SettingsResponse = {
  data: AuthMeResponse["data"]["settings"];
};

type AuthEnvelopeResponse = {
  data: AuthMeResponse["data"];
};

type MessageResponse = {
  message: string;
};

type AvatarUploadResponse = {
  data: NonNullable<NonNullable<AuthMeResponse["data"]["user"]>["avatar_object"]>;
};

function invalidateAuth(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
}

function mergeAuthEnvelope(queryClient: ReturnType<typeof useQueryClient>, payload: AuthEnvelopeResponse) {
  const existing = queryClient.getQueryData<AuthMeResponse>(queryKeys.auth.me);

  queryClient.setQueryData<AuthMeResponse>(queryKeys.auth.me, {
    authenticated: existing?.authenticated ?? true,
    data: payload.data,
  });
}

export function useUpdateThemeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (theme: "system" | "light" | "dark") =>
      apiClient.patch<SettingsResponse>("/api/settings/theme", { theme }),
    onSuccess: () => invalidateAuth(queryClient),
  });
}

export function useUpdatePresenceSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { show_active_status: boolean; allow_message_requests: boolean }) =>
      apiClient.patch<SettingsResponse>("/api/settings/presence", payload),
    onSuccess: () => invalidateAuth(queryClient),
  });
}

export function useUpdateNotificationSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { push_enabled: boolean; sound_enabled: boolean; vibrate_enabled: boolean }) =>
      apiClient.patch<SettingsResponse>("/api/settings/notifications", payload),
    onSuccess: () => invalidateAuth(queryClient),
  });
}

export function useUpdateQuietHoursMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      quiet_hours_enabled: boolean;
      quiet_hours_start: string | null;
      quiet_hours_end: string | null;
      quiet_hours_timezone: string;
    }) => apiClient.patch<SettingsResponse>("/api/settings/quiet-hours", payload),
    onSuccess: () => invalidateAuth(queryClient),
  });
}

export function useUploadUserAvatarMutation() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "user_avatar");

      return apiClient.post<AvatarUploadResponse>("/api/uploads", formData);
    },
  });
}

export function useDeleteAccountAvatarMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storageObjectId: number) => apiClient.delete<AuthEnvelopeResponse>(`/api/settings/avatar/${storageObjectId}`),
    onSuccess: (payload) => {
      mergeAuthEnvelope(queryClient, payload);
      invalidateAuth(queryClient);
    },
  });
}

export function useUpdateAccountProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      username: string;
      email: string | null;
      phone: string | null;
      avatar_object_id: number | null;
    }) => apiClient.patch<AuthEnvelopeResponse>("/api/settings/profile", payload),
    onSuccess: (payload) => {
      mergeAuthEnvelope(queryClient, payload);
      invalidateAuth(queryClient);
    },
  });
}

export function useUpdateAccountPasswordMutation() {
  return useMutation({
    mutationFn: (payload: {
      current_password: string;
      password: string;
      password_confirmation: string;
    }) => apiClient.patch<MessageResponse>("/api/settings/password", payload),
  });
}
