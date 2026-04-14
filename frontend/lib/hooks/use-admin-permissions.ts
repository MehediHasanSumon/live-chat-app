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

type PermissionsResponse = {
  data: AdminPermissionRecord[];
};

type PermissionResponse = {
  data: AdminPermissionRecord;
};

type PermissionPayload = {
  name: string;
};

export function useAdminPermissionsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.permissions,
    queryFn: () => apiClient.get<PermissionsResponse>("/api/admin/permissions", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useCreateAdminPermissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PermissionPayload) =>
      apiClient.post<PermissionResponse>("/api/admin/permissions", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.permissions });
    },
  });
}

export function useUpdateAdminPermissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ permissionId, payload }: { permissionId: number; payload: PermissionPayload }) =>
      apiClient.patch<PermissionResponse>(`/api/admin/permissions/${permissionId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.permissions });
    },
  });
}

export function useDeleteAdminPermissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (permissionId: number) =>
      apiClient.delete<void>(`/api/admin/permissions/${permissionId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.permissions });
    },
  });
}
