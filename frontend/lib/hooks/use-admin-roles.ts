"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AdminRolePermission = {
  id: number;
  name: string;
  guard_name: string;
};

export type AdminRoleRecord = {
  id: number;
  name: string;
  guard_name: string;
  permissions: AdminRolePermission[];
  permissions_count: number;
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

export type RolesResponse = {
  data: AdminRoleRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type RoleResponse = {
  data: AdminRoleRecord;
};

export type AdminPermissionOption = {
  id: number;
  name: string;
  guard_name: string;
  created_at: string | null;
  updated_at: string | null;
};

type PermissionOptionsResponse = {
  data: AdminPermissionOption[];
};

type RolePayload = {
  name: string;
  permissions: string[];
};

type RoleListParams = {
  page: number;
  perPage: number;
  search: string;
};

function buildRolesPath({ page, perPage, search }: RoleListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return `/api/admin/roles?${params.toString()}`;
}

export function useAdminRolesQuery(params: RoleListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.roles.list(params.page, params.perPage, params.search.trim()),
    queryFn: () => apiClient.get<RolesResponse>(buildRolesPath(params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}

export function useAdminPermissionOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.permissions.options,
    queryFn: () => apiClient.get<PermissionOptionsResponse>("/api/admin/permissions/options", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useCreateAdminRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RolePayload) => apiClient.post<RoleResponse>("/api/admin/roles", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles.all });
    },
  });
}

export function useUpdateAdminRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: number; payload: RolePayload }) =>
      apiClient.patch<RoleResponse>(`/api/admin/roles/${roleId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles.all });
    },
  });
}

export function useDeleteAdminRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: number) => apiClient.delete<void>(`/api/admin/roles/${roleId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles.all });
    },
  });
}
