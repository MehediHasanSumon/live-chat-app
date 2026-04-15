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

type ForgotPasswordPayload = {
  email: string;
};

type ResetPasswordPayload = {
  email: string;
  code: string;
  password: string;
  password_confirmation: string;
};

type VerifyEmailPayload = {
  code: string;
};

type MessageResponse = {
  message: string;
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

function setAuthenticatedPayload(queryClient: ReturnType<typeof useQueryClient>, payload: AuthMeResponse) {
  queryClient.setQueryData(queryKeys.auth.me, payload);
  if (payload.data.user) {
    useAuthStore.getState().setAuthenticated({
      user: payload.data.user,
      settings: payload.data.settings,
    });
  } else {
    useAuthStore.getState().clearAuthenticated();
  }
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => apiClient.post<AuthMeResponse>("/login", payload),
    onSuccess: async (response) => {
      const authenticatedUser = await resolveAuthenticatedUser();
      markSessionHintAuthenticated();
      const payload = authenticatedUser ?? response;
      setAuthenticatedPayload(queryClient, payload);
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
      setAuthenticatedPayload(queryClient, payload);
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) => apiClient.post<MessageResponse>("/forgot-password", payload),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => apiClient.post<MessageResponse>("/reset-password", payload),
  });
}

export function useSendEmailVerificationCodeMutation() {
  return useMutation({
    mutationFn: () => apiClient.post<MessageResponse>("/email/verification/send"),
  });
}

export function useVerifyEmailCodeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: VerifyEmailPayload) => apiClient.post<AuthMeResponse>("/email/verification/verify", payload),
    onSuccess: (payload) => {
      setAuthenticatedPayload(queryClient, payload);
    },
  });
}

type LogoutMutationOptions = {
  clearAuthenticatedOnSuccess?: boolean;
};

export function useLogoutMutation({ clearAuthenticatedOnSuccess = true }: LogoutMutationOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await notifyPresenceOffline();
      return apiClient.post<void>("/logout");
    },
    onSuccess: () => {
      clearSessionHint();
      if (clearAuthenticatedOnSuccess) {
        queryClient.removeQueries({ queryKey: queryKeys.auth.me });
        useAuthStore.getState().clearAuthenticated();
      }
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 401) {
        clearSessionHint();
        if (clearAuthenticatedOnSuccess) {
          queryClient.removeQueries({ queryKey: queryKeys.auth.me });
          useAuthStore.getState().clearAuthenticated();
        }
      }
    },
  });
}
