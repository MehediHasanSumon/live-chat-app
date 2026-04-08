"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import {
  type StorageCleanupPreview,
  type StorageCleanupRun,
  type StorageObjectAdminItem,
  type StoragePolicy,
  type StorageUsage,
} from "@/lib/storage-admin";

const storageAdminKeys = {
  policy: ["admin", "storage", "policy"] as const,
  usage: ["admin", "storage", "usage"] as const,
};

type PolicyResponse = { data: StoragePolicy };
type UsageResponse = { data: StorageUsage };
type CleanupPreviewResponse = { data: StorageCleanupPreview };
type CleanupRunResponse = { data: StorageCleanupRun };
type StorageObjectResponse = { data: StorageObjectAdminItem };

export function useStoragePolicyQuery() {
  return useQuery({
    queryKey: storageAdminKeys.policy,
    queryFn: () => apiClient.get<PolicyResponse>("/api/admin/storage/policy", { skipAuthRedirect: true }),
    retry: false,
    select: (response) => response.data,
  });
}

export function useStorageUsageQuery() {
  return useQuery({
    queryKey: storageAdminKeys.usage,
    queryFn: () => apiClient.get<UsageResponse>("/api/admin/storage/usage", { skipAuthRedirect: true }),
    retry: false,
    select: (response) => response.data,
  });
}

export function useUpdateStoragePolicyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<StoragePolicy>) =>
      apiClient.patch<PolicyResponse>("/api/admin/storage/policy", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageAdminKeys.policy });
      queryClient.invalidateQueries({ queryKey: storageAdminKeys.usage });
    },
  });
}

export function useStorageCleanupPreviewMutation() {
  return useMutation({
    mutationFn: (payload: { rule_key: "large_after_7d" | "small_after_30d"; limit?: number }) =>
      apiClient.post<CleanupPreviewResponse>("/api/admin/storage/cleanup/preview", payload),
  });
}

export function useRunStorageCleanupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { rule_key: "large_after_7d" | "small_after_30d" | "manual"; dry_run?: boolean }) =>
      apiClient.post<CleanupRunResponse>("/api/admin/storage/cleanup/run", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageAdminKeys.policy });
      queryClient.invalidateQueries({ queryKey: storageAdminKeys.usage });
    },
  });
}

export function useExemptStorageObjectMutation() {
  return useMutation({
    mutationFn: (storageObjectId: number) =>
      apiClient.post<StorageObjectResponse>(`/api/admin/storage/objects/${storageObjectId}/exempt`),
  });
}

export function useRemoveExemptionMutation() {
  return useMutation({
    mutationFn: (storageObjectId: number) =>
      apiClient.delete<StorageObjectResponse>(`/api/admin/storage/objects/${storageObjectId}/exempt`),
  });
}
