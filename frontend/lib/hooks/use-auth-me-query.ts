"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiClientError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AuthMeResponse = {
  authenticated?: boolean;
  data: {
    user: {
      id: number;
      username: string;
      name: string;
      email: string | null;
      email_verified_at: string | null;
      phone: string | null;
      status: "active" | "suspended" | "deleted";
      last_seen_at: string | null;
      avatar_object_id: number | null;
    } | null;
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
    email_verification_required: boolean;
    must_verify_email: boolean;
  };
};

export async function fetchAuthMe() {
  const response = await fetch("/auth/me", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiClientError(response.status, { message: "Unable to resolve auth state." });
  }

  return response.json() as Promise<AuthMeResponse>;
}

export function useAuthMeQuery(enabled = false) {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: fetchAuthMe,
    enabled,
    retry: false,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}
