"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AdminPermissionRecord = {
  id: number;
  name: string;
  guard_name: string;
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

export type PermissionsResponse = {
  data: AdminPermissionRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type PermissionResponse = {
  data: AdminPermissionRecord;
};

type PermissionPayload = {
  name: string;
};

type PermissionListParams = {
  page: number;
  perPage: number;
  search: string;
};

function buildPermissionsPath({ page, perPage, search }: PermissionListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return `/api/admin/permissions?${params.toString()}`;
}

export function useAdminPermissionsQuery(params: PermissionListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.permissions.list(params.page, params.perPage, params.search.trim()),
    queryFn: () => apiClient.get<PermissionsResponse>(buildPermissionsPath(params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}

export function useCreateAdminPermissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PermissionPayload) =>
      apiClient.post<PermissionResponse>("/api/admin/permissions", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.permissions.all });
    },
  });
}

export function useUpdateAdminPermissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ permissionId, payload }: { permissionId: number; payload: PermissionPayload }) =>
      apiClient.patch<PermissionResponse>(`/api/admin/permissions/${permissionId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.permissions.all });
    },
  });
}

export function useDeleteAdminPermissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (permissionId: number) =>
      apiClient.delete<void>(`/api/admin/permissions/${permissionId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.permissions.all });
    },
  });
}
