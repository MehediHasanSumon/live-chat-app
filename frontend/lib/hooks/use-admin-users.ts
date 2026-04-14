"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AdminUserRole = {
  id: number;
  name: string;
  guard_name: string;
};

export type AdminUserStatus = "active" | "suspended" | "deleted";

export type AdminUserRecord = {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string | null;
  email_verified_at: string | null;
  status: AdminUserStatus;
  roles: AdminUserRole[];
  roles_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type PaginationMeta = {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
};

type PaginationLinks = {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
};

export type UsersResponse = {
  data: AdminUserRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type UserResponse = {
  data: AdminUserRecord;
};

export type AdminRoleOption = {
  id: number;
  name: string;
  guard_name: string;
};

type RoleOptionsResponse = {
  data: AdminRoleOption[];
};

export type UserPayload = {
  name: string;
  email: string;
  phone: string | null;
  email_verified: boolean;
  password: string;
  password_confirmation: string;
  status: AdminUserStatus;
  roles: string[];
};

type UserListParams = {
  page: number;
  perPage: number;
  search: string;
};

function buildUsersPath({ page, perPage, search }: UserListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return `/api/admin/users?${params.toString()}`;
}

export function useAdminUsersQuery(params: UserListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.users.list(params.page, params.perPage, params.search.trim()),
    queryFn: () => apiClient.get<UsersResponse>(buildUsersPath(params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}

export function useAdminRoleOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.roles.options,
    queryFn: () => apiClient.get<RoleOptionsResponse>("/api/admin/roles/options", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useCreateAdminUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UserPayload) => apiClient.post<UserResponse>("/api/admin/users", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
    },
  });
}

export function useUpdateAdminUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: UserPayload }) =>
      apiClient.patch<UserResponse>(`/api/admin/users/${userId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
    },
  });
}

export function useDeleteAdminUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => apiClient.delete<void>(`/api/admin/users/${userId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
    },
  });
}
