"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AdminProductUnitRecord = {
  id: number;
  unit_name: string;
  unit_value: string;
  unit_code: string;
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

export type ProductUnitsResponse = {
  data: AdminProductUnitRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type ProductUnitResponse = {
  data: AdminProductUnitRecord;
};

type ProductUnitOptionsResponse = {
  data: AdminProductUnitRecord[];
};

export type ProductUnitPayload = {
  unit_name: string;
  unit_value: string;
};

type ProductUnitListParams = {
  page: number;
  perPage: number;
  search: string;
};

function buildProductUnitsPath({ page, perPage, search }: ProductUnitListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return `/api/admin/product-units?${params.toString()}`;
}

export function useAdminProductUnitsQuery(params: ProductUnitListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.productUnits.list(params.page, params.perPage, params.search.trim()),
    queryFn: () => apiClient.get<ProductUnitsResponse>(buildProductUnitsPath(params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}

export function useAdminProductUnitOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.productUnits.options,
    queryFn: () => apiClient.get<ProductUnitOptionsResponse>("/api/admin/product-units/options", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useCreateAdminProductUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProductUnitPayload) =>
      apiClient.post<ProductUnitResponse>("/api/admin/product-units", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.productUnits.all });
    },
  });
}

export function useUpdateAdminProductUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productUnitId, payload }: { productUnitId: number; payload: ProductUnitPayload }) =>
      apiClient.patch<ProductUnitResponse>(`/api/admin/product-units/${productUnitId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.productUnits.all });
    },
  });
}

export function useDeleteAdminProductUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productUnitId: number) =>
      apiClient.delete<void>(`/api/admin/product-units/${productUnitId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.productUnits.all });
    },
  });
}
