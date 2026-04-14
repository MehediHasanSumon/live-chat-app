"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type AdminSystemLogRecord = {
  id: number;
  log_name: string | null;
  event: string | null;
  description: string;
  subject_type: string | null;
  subject_id: number | null;
  subject_label: string | null;
  causer_type: string | null;
  causer_id: number | null;
  causer_label: string | null;
  properties: Record<string, JsonValue>;
  batch_uuid: string | null;
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

export type SystemLogsResponse = {
  data: AdminSystemLogRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type SystemLogListParams = {
  page: number;
  perPage: number;
  search: string;
};

function buildSystemLogsPath({ page, perPage, search }: SystemLogListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return `/api/admin/system-logs?${params.toString()}`;
}

export function useAdminSystemLogsQuery(params: SystemLogListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.systemLogs.list(params.page, params.perPage, params.search.trim()),
    queryFn: () => apiClient.get<SystemLogsResponse>(buildSystemLogsPath(params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}
