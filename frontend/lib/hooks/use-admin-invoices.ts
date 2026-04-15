"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type InvoicePaymentType = "due" | "cash" | "pos";
export type InvoicePaymentStatus = "unpaid" | "partial" | "paid";
export type InvoiceStatus = "draft" | "submitted" | "cancelled";

export type AdminInvoiceCustomer = {
  id: number;
  name: string;
  mobile: string | null;
  vehicle_no: string | null;
};

export type AdminInvoiceItem = {
  id: number;
  product_id: number | null;
  product_price_id: number | null;
  product_unit_id: number | null;
  product_name: string;
  unit_name: string | null;
  unit_code: string | null;
  unit_value: string | null;
  price: string;
  quantity: string;
  line_total: string;
};

export type AdminInvoiceRecord = {
  id: number;
  invoice_no: string;
  invoice_datetime: string | null;
  customer: AdminInvoiceCustomer | null;
  payment_type: InvoicePaymentType;
  payment_status: InvoicePaymentStatus;
  subtotal_amount: string;
  discount_amount: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  sms_enabled: boolean;
  status: InvoiceStatus;
  items: AdminInvoiceItem[];
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

export type InvoicesResponse = {
  data: AdminInvoiceRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type InvoiceResponse = {
  data: AdminInvoiceRecord;
};

type InvoiceNumberResponse = {
  data: {
    invoice_no: string;
  };
};

export type InvoicePayload = {
  invoice_no: string;
  invoice_datetime: string;
  customer_id?: number | null;
  customer?: {
    name: string;
    mobile: string | null;
    vehicle_no: string | null;
  };
  payment_type: InvoicePaymentType;
  paid_amount?: number | null;
  discount_amount?: number | null;
  sms_enabled: boolean;
  status: InvoiceStatus;
  items: Array<{
    product_id: number;
    product_price_id: number | null;
    product_unit_id: number | null;
    price?: number | null;
    quantity: number;
  }>;
};

type InvoiceListParams = {
  page: number;
  perPage: number;
  search: string;
};

function buildInvoicesPath({ page, perPage, search }: InvoiceListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return `/api/admin/invoices?${params.toString()}`;
}

export function useAdminInvoicesQuery(params: InvoiceListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.invoices.list(params.page, params.perPage, params.search.trim()),
    queryFn: () => apiClient.get<InvoicesResponse>(buildInvoicesPath(params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}

export function useAdminInvoiceQuery(invoiceId: number | string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.invoices.detail(invoiceId),
    queryFn: () => apiClient.get<InvoiceResponse>(`/api/admin/invoices/${invoiceId}`, { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useAdminNextInvoiceNoQuery(date: string, enabled = true) {
  const params = new URLSearchParams();

  if (date) {
    params.set("date", date);
  }

  const path = params.toString() ? `/api/admin/invoices/next-number?${params.toString()}` : "/api/admin/invoices/next-number";

  return useQuery({
    queryKey: queryKeys.admin.invoices.nextNumber(date),
    queryFn: () => apiClient.get<InvoiceNumberResponse>(path, { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useCreateAdminInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InvoicePayload) => apiClient.post<InvoiceResponse>("/api/admin/invoices", payload, { skipAuthRedirect: true }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.invoices.all });
      queryClient.setQueryData(queryKeys.admin.invoices.detail(response.data.id), response.data);
    },
  });
}
