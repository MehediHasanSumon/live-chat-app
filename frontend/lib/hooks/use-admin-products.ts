"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AdminProductStatus = "active" | "inactive";

export type AdminProductUnit = {
  id: number;
  unit_name: string;
  unit_value: string;
  unit_code: string;
};

export type AdminProductActivePrice = {
  id: number;
  original_price: string;
  sell_price: string;
  date_time: string | null;
  unit: AdminProductUnit | null;
};

export type AdminProductRecord = {
  id: number;
  product_name: string;
  product_code: string | null;
  description: string | null;
  status: AdminProductStatus;
  active_price: AdminProductActivePrice | null;
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

export type ProductsResponse = {
  data: AdminProductRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type ProductResponse = {
  data: AdminProductRecord;
};

export type ProductPayload = {
  product_name: string;
  description: string | null;
  status: AdminProductStatus;
};

type ProductListParams = {
  page: number;
  perPage: number;
  search: string;
};

function buildProductsPath({ page, perPage, search }: ProductListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return `/api/admin/products?${params.toString()}`;
}

export function useAdminProductsQuery(params: ProductListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.products.list(params.page, params.perPage, params.search.trim()),
    queryFn: () => apiClient.get<ProductsResponse>(buildProductsPath(params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}

export function useCreateAdminProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProductPayload) => apiClient.post<ProductResponse>("/api/admin/products", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },
  });
}

export function useUpdateAdminProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, payload }: { productId: number; payload: ProductPayload }) =>
      apiClient.patch<ProductResponse>(`/api/admin/products/${productId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },
  });
}

export function useDeleteAdminProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: number) => apiClient.delete<void>(`/api/admin/products/${productId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },
  });
}
