"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClientError, apiClient } from "@/lib/api-client";
import { type AuthMeResponse } from "@/lib/hooks/use-auth-me-query";
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
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.auth.me, response);
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => apiClient.post<AuthMeResponse>("/register", payload),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.auth.me, response);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<void>("/logout"),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.auth.me });
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 401) {
        queryClient.removeQueries({ queryKey: queryKeys.auth.me });
      }
    },
  });
}
