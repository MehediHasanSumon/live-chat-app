"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AdminCustomerRecord = {
  id: number;
  name: string;
  mobile: string | null;
  vehicle_no: string | null;
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

export type CustomersResponse = {
  data: AdminCustomerRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type CustomerResponse = {
  data: AdminCustomerRecord;
};

type CustomerOptionsResponse = {
  data: AdminCustomerRecord[];
};

export type CustomerPayload = {
  name: string;
  mobile: string | null;
  vehicle_no: string | null;
};

type CustomerListParams = {
  page: number;
  perPage: number;
  search: string;
};

function buildCustomersPath({ page, perPage, search }: CustomerListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return `/api/admin/customers?${params.toString()}`;
}

export function useAdminCustomersQuery(params: CustomerListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.customers.list(params.page, params.perPage, params.search.trim()),
    queryFn: () => apiClient.get<CustomersResponse>(buildCustomersPath(params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}

export function useAdminCustomerOptionsQuery(search = "", enabled = true) {
  const normalizedSearch = search.trim();
  const params = new URLSearchParams();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  const path = params.toString() ? `/api/admin/customers/options?${params.toString()}` : "/api/admin/customers/options";

  return useQuery({
    queryKey: [...queryKeys.admin.customers.options, normalizedSearch] as const,
    queryFn: () => apiClient.get<CustomerOptionsResponse>(path, { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useCreateAdminCustomerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CustomerPayload) => apiClient.post<CustomerResponse>("/api/admin/customers", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.customers.all });
    },
  });
}

export function useUpdateAdminCustomerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, payload }: { customerId: number; payload: CustomerPayload }) =>
      apiClient.patch<CustomerResponse>(`/api/admin/customers/${customerId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.customers.all });
    },
  });
}

export function useDeleteAdminCustomerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (customerId: number) => apiClient.delete<void>(`/api/admin/customers/${customerId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.customers.all });
    },
  });
}
