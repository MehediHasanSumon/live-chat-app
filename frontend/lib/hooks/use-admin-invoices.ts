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

export type InvoiceStatementFilters = {
  dateFrom: string;
  dateTo: string;
  paymentType: InvoicePaymentType | "";
  createdBy: string;
};

export type InvoiceStatementRange = {
  from: string;
  to: string;
};

export type InvoiceStatementSummary = {
  invoice_count: number;
  item_count: number;
  subtotal_amount: string;
  discount_amount: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  cash_amount: string;
  pos_amount: string;
  due_sales_amount: string;
};

export type InvoiceStatementProductSummary = {
  product_name: string;
  unit_name: string | null;
  unit_code: string | null;
  invoice_count: number;
  item_count: number;
  quantity: string;
  line_total: string;
  average_price: string;
};

export type DailyStatementInvoice = {
  id: number;
  invoice_no: string;
  invoice_datetime: string | null;
  customer: AdminInvoiceCustomer | null;
  payment_type: InvoicePaymentType;
  payment_status: InvoicePaymentStatus;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  item_count: number;
};

export type DailyInvoiceStatement = {
  period_type: "daily";
  date: string;
  range: InvoiceStatementRange;
  filters: {
    payment_type: InvoicePaymentType | null;
    created_by: number | null;
  };
  summary: InvoiceStatementSummary;
  product_summaries: InvoiceStatementProductSummary[];
  invoices: DailyStatementInvoice[];
};

export type MonthlyStatementDaySummary = {
  statement_date: string;
  invoice_count: number;
  subtotal_amount: string;
  discount_amount: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  cash_amount: string;
  pos_amount: string;
  due_sales_amount: string;
};

export type MonthlyInvoiceStatement = {
  period_type: "monthly";
  month: string;
  range: InvoiceStatementRange;
  filters: {
    payment_type: InvoicePaymentType | null;
    created_by: number | null;
  };
  summary: InvoiceStatementSummary;
  daily_summaries: MonthlyStatementDaySummary[];
  product_summaries: InvoiceStatementProductSummary[];
};

type DailyInvoiceStatementResponse = {
  data: DailyInvoiceStatement;
};

type MonthlyInvoiceStatementResponse = {
  data: MonthlyInvoiceStatement;
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

function normalizedStatementFilters(filters: InvoiceStatementFilters) {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    paymentType: filters.paymentType,
    createdBy: filters.createdBy,
  };
}

function buildStatementSearchParams(filters: InvoiceStatementFilters) {
  const params = new URLSearchParams();

  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }

  if (filters.paymentType) {
    params.set("payment_type", filters.paymentType);
  }

  if (filters.createdBy) {
    params.set("created_by", filters.createdBy);
  }

  return params;
}

function buildDailyStatementPath(filters: InvoiceStatementFilters) {
  const params = buildStatementSearchParams(filters);

  return params.toString() ? `/api/admin/invoices/statements/daily?${params.toString()}` : "/api/admin/invoices/statements/daily";
}

function buildMonthlyStatementPath(filters: InvoiceStatementFilters) {
  const params = buildStatementSearchParams(filters);

  return params.toString() ? `/api/admin/invoices/statements/monthly?${params.toString()}` : "/api/admin/invoices/statements/monthly";
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

export function useAdminDailyInvoiceStatementQuery(filters: InvoiceStatementFilters, enabled = true) {
  const normalizedFilters = normalizedStatementFilters(filters);

  return useQuery({
    queryKey: queryKeys.admin.invoices.dailyStatement(normalizedFilters),
    queryFn: () => apiClient.get<DailyInvoiceStatementResponse>(buildDailyStatementPath(normalizedFilters), { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useAdminMonthlyInvoiceStatementQuery(filters: InvoiceStatementFilters, enabled = true) {
  const normalizedFilters = normalizedStatementFilters(filters);

  return useQuery({
    queryKey: queryKeys.admin.invoices.monthlyStatement(normalizedFilters),
    queryFn: () => apiClient.get<MonthlyInvoiceStatementResponse>(buildMonthlyStatementPath(normalizedFilters), { skipAuthRedirect: true }),
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

export function useUpdateAdminInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: number | string; payload: InvoicePayload }) =>
      apiClient.patch<InvoiceResponse>(`/api/admin/invoices/${invoiceId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.invoices.all });
      queryClient.setQueryData(queryKeys.admin.invoices.detail(response.data.id), response.data);
    },
  });
}

export function useDeleteAdminInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoiceId: number | string) => apiClient.delete<void>(`/api/admin/invoices/${invoiceId}`, { skipAuthRedirect: true }),
    onSuccess: async (_response, invoiceId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.invoices.all });
      queryClient.removeQueries({ queryKey: queryKeys.admin.invoices.detail(invoiceId) });
    },
  });
}
