"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClientError, apiClient, clearSessionHint, markSessionHintAuthenticated } from "@/lib/api-client";
import { fetchAuthMe, type AuthMeResponse } from "@/lib/hooks/use-auth-me-query";
import { notifyPresenceOffline } from "@/lib/presence";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/lib/stores/auth-store";

type LoginPayload = {
  login: string;
  password: string;
  remember?: boolean;
};

type RegisterPayload = {
  username: string;
  name: string;
  email?: string;
  phone?: string;
  password: string;
  password_confirmation: string;
};

async function resolveAuthenticatedUser(attempts = 3): Promise<AuthMeResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchAuthMe();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => {
        window.setTimeout(resolve, 150 * (attempt + 1));
      });
    }
  }

  throw lastError;
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => apiClient.post<AuthMeResponse>("/login", payload),
    onSuccess: async (response) => {
      const authenticatedUser = await resolveAuthenticatedUser();
      markSessionHintAuthenticated();
      const payload = authenticatedUser ?? response;
      queryClient.setQueryData(queryKeys.auth.me, payload);
      if (payload.data.user) {
        useAuthStore.getState().setAuthenticated({
          user: payload.data.user,
          settings: payload.data.settings,
        });
      } else {
        useAuthStore.getState().clearAuthenticated();
      }
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => apiClient.post<AuthMeResponse>("/register", payload),
    onSuccess: async (response) => {
      const authenticatedUser = await resolveAuthenticatedUser();
      markSessionHintAuthenticated();
      const payload = authenticatedUser ?? response;
      queryClient.setQueryData(queryKeys.auth.me, payload);
      if (payload.data.user) {
        useAuthStore.getState().setAuthenticated({
          user: payload.data.user,
          settings: payload.data.settings,
        });
      } else {
        useAuthStore.getState().clearAuthenticated();
      }
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await notifyPresenceOffline();
      return apiClient.post<void>("/logout");
    },
    onSuccess: () => {
      clearSessionHint();
      queryClient.removeQueries({ queryKey: queryKeys.auth.me });
      useAuthStore.getState().clearAuthenticated();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 401) {
        clearSessionHint();
        queryClient.removeQueries({ queryKey: queryKeys.auth.me });
        useAuthStore.getState().clearAuthenticated();
      }
    },
  });
}
