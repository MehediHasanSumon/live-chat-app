"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { AdminProductStatus, AdminProductUnit } from "@/lib/hooks/use-admin-products";
import { queryKeys } from "@/lib/query-keys";

export type AdminProductPriceProduct = {
  id: number;
  product_name: string;
  product_code: string | null;
  status: AdminProductStatus;
};

export type AdminProductPriceCreator = {
  id: number;
  name: string;
};

export type AdminProductPriceRecord = {
  id: number;
  product_id: number;
  product: AdminProductPriceProduct | null;
  product_unit_id: number | null;
  unit: AdminProductUnit | null;
  original_price: string;
  sell_price: string;
  date_time: string | null;
  is_active: boolean;
  created_by: number | null;
  creator: AdminProductPriceCreator | null;
  deactivated_at: string | null;
  note: string | null;
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

export type ProductPricesResponse = {
  data: AdminProductPriceRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type ProductPriceResponse = {
  data: AdminProductPriceRecord;
};

export type ProductPricePayload = {
  product_id: number;
  product_unit_id: number | null;
  original_price: number;
  sell_price: number;
  date_time: string;
  is_active: boolean;
  deactivated_at: string | null;
  note: string | null;
};

type ProductPriceListParams = {
  page: number;
  perPage: number;
  search: string;
};

function buildProductPricesPath({ page, perPage, search }: ProductPriceListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return `/api/admin/product-prices?${params.toString()}`;
}

export function useAdminProductPricesQuery(params: ProductPriceListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.productPrices.list(params.page, params.perPage, params.search.trim()),
    queryFn: () => apiClient.get<ProductPricesResponse>(buildProductPricesPath(params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}

export function useCreateAdminProductPriceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProductPricePayload) =>
      apiClient.post<ProductPriceResponse>("/api/admin/product-prices", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.productPrices.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },
  });
}

export function useUpdateAdminProductPriceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productPriceId, payload }: { productPriceId: number; payload: ProductPricePayload }) =>
      apiClient.patch<ProductPriceResponse>(`/api/admin/product-prices/${productPriceId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.productPrices.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },
  });
}

export function useDeleteAdminProductPriceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productPriceId: number) =>
      apiClient.delete<void>(`/api/admin/product-prices/${productPriceId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.productPrices.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },
  });
}
