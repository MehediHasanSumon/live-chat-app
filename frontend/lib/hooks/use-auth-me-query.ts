"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AuthMeResponse = {
  data: {
    user: {
      id: number;
      username: string;
      name: string;
      email: string | null;
      phone: string | null;
      status: "active" | "suspended" | "deleted";
      last_seen_at: string | null;
      avatar_object_id: number | null;
    };
    settings: {
      theme: "system" | "light" | "dark";
      show_active_status: boolean;
      allow_message_requests: boolean;
      push_enabled: boolean;
      sound_enabled: boolean;
      vibrate_enabled: boolean;
      quiet_hours_enabled: boolean;
      quiet_hours_start: string | null;
      quiet_hours_end: string | null;
      quiet_hours_timezone: string;
    } | null;
  };
};

export function useAuthMeQuery(enabled = false) {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => apiClient.get<AuthMeResponse>("/api/me", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });
}
