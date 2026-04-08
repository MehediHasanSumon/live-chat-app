"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClientError, apiClient, clearSessionHint, markSessionHintAuthenticated } from "@/lib/api-client";
import { fetchAuthMe, type AuthMeResponse } from "@/lib/hooks/use-auth-me-query";
import { queryKeys } from "@/lib/query-keys";

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

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => apiClient.post<AuthMeResponse>("/login", payload),
    onSuccess: async (response) => {
      markSessionHintAuthenticated();
      queryClient.setQueryData(queryKeys.auth.me, response);
      await queryClient.fetchQuery({
        queryKey: queryKeys.auth.me,
        queryFn: fetchAuthMe,
      });
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => apiClient.post<AuthMeResponse>("/register", payload),
    onSuccess: async (response) => {
      markSessionHintAuthenticated();
      queryClient.setQueryData(queryKeys.auth.me, response);
      await queryClient.fetchQuery({
        queryKey: queryKeys.auth.me,
        queryFn: fetchAuthMe,
      });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<void>("/logout"),
    onSuccess: () => {
      clearSessionHint();
      queryClient.removeQueries({ queryKey: queryKeys.auth.me });
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 401) {
        clearSessionHint();
        queryClient.removeQueries({ queryKey: queryKeys.auth.me });
      }
    },
  });
}
