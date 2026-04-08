"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type AuthMeResponse } from "@/lib/hooks/use-auth-me-query";
import { queryKeys } from "@/lib/query-keys";

type SettingsResponse = {
  data: AuthMeResponse["data"]["settings"];
};

function invalidateAuth(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
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
