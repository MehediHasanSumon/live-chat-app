"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AdminOpsHealth = {
  overall_status: string;
  checked_at: string;
  services: Record<string, { status: string; [key: string]: unknown }>;
};

export type AdminOpsStatus = {
  checked_at: string;
  app: {
    name: string;
    env: string;
    debug: boolean;
    url: string;
  };
  queues: {
    connection: string;
    names: string[];
    pending_jobs: Record<string, number>;
    failed_jobs: number;
  };
  notifications: {
    outbox: Record<string, number>;
  };
  calls: {
    active: number;
    ended: number;
  };
  storage: {
    usage: {
      live_object_count: number;
      live_bytes: number;
      deleted_bytes_total: number;
    };
    policy: {
      auto_cleanup_enabled: boolean;
    };
  };
  reverb: {
    configured: boolean;
  };
  livekit: {
    configured: boolean;
  };
  horizon: {
    enabled: boolean;
    configured: boolean;
  };
};

type HealthResponse = { data: AdminOpsHealth };
type StatusResponse = { data: AdminOpsStatus };

export function useAdminOpsHealthQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.opsHealth,
    queryFn: () => apiClient.get<HealthResponse>("/api/admin/ops/health", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useAdminOpsStatusQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.opsStatus,
    queryFn: () => apiClient.get<StatusResponse>("/api/admin/ops/status", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}
