"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AdminSmsStatus = "active" | "inactive";
export type AdminInvoiceSmsLogStatus = "pending" | "sent" | "failed";

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

export type AdminSmsCredentialRecord = {
  id: number;
  url: string;
  sender_id: string;
  status: AdminSmsStatus;
  api_key_present: boolean;
  api_key_preview: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SmsCredentialPayload = {
  url: string;
  api_key?: string;
  sender_id: string;
  status: AdminSmsStatus;
};

export type SmsCredentialsResponse = {
  data: AdminSmsCredentialRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type SmsCredentialResponse = {
  data: AdminSmsCredentialRecord | null;
};

export type InvoiceSmsTemplateRecord = {
  id: number;
  name: string;
  body: string;
  variables_json: string[] | null;
  status: AdminSmsStatus;
  is_default: boolean;
  created_by: number | null;
  updated_by: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type InvoiceSmsTemplatePayload = {
  name: string;
  body: string;
  variables_json: string[] | null;
  status: AdminSmsStatus;
  is_default: boolean;
};

export type InvoiceSmsTemplatesResponse = {
  data: InvoiceSmsTemplateRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type InvoiceSmsTemplateResponse = {
  data: InvoiceSmsTemplateRecord;
};

type InvoiceSmsTemplateOptionsResponse = {
  data: InvoiceSmsTemplateRecord[];
};

export type InvoiceSmsVariable = {
  key: string;
  token: string;
  blade_token: string;
};

type InvoiceSmsVariablesResponse = {
  data: InvoiceSmsVariable[];
};

export type InvoiceSmsLogRecord = {
  id: number;
  invoice_id: number;
  invoice: {
    id: number;
    invoice_no: string;
    total_amount: string;
    customer: {
      id: number;
      name: string;
      mobile: string | null;
    } | null;
  } | null;
  customer_id: number | null;
  customer: {
    id: number;
    name: string;
    mobile: string | null;
    vehicle_no: string | null;
  } | null;
  sms_service_credential_id: number | null;
  credential: {
    id: number;
    url: string;
    sender_id: string;
    status: AdminSmsStatus;
  } | null;
  invoice_sms_template_id: number | null;
  template: {
    id: number;
    name: string;
    status: AdminSmsStatus;
  } | null;
  recipient_name: string | null;
  mobile: string;
  sender_id: string | null;
  message: string | null;
  status: AdminInvoiceSmsLogStatus;
  provider_response: unknown;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type InvoiceSmsLogsResponse = {
  data: InvoiceSmsLogRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type SmsListParams = {
  page: number;
  perPage: number;
  search: string;
  status: string;
};

function buildListPath(basePath: string, { page, perPage, search, status }: SmsListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();
  const normalizedStatus = status.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  if (normalizedStatus) {
    params.set("status", normalizedStatus);
  }

  return `${basePath}?${params.toString()}`;
}

export function useAdminSmsCredentialsQuery(params: SmsListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.smsCredentials.list(params.page, params.perPage, params.search.trim(), params.status.trim()),
    queryFn: () => apiClient.get<SmsCredentialsResponse>(buildListPath("/api/admin/sms/credentials", params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}

export function useActiveAdminSmsCredentialQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.smsCredentials.active,
    queryFn: () => apiClient.get<SmsCredentialResponse>("/api/admin/sms/credentials/active", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useCreateAdminSmsCredentialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SmsCredentialPayload) =>
      apiClient.post<SmsCredentialResponse>("/api/admin/sms/credentials", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.smsCredentials.all });
    },
  });
}

export function useUpdateAdminSmsCredentialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ credentialId, payload }: { credentialId: number; payload: SmsCredentialPayload }) =>
      apiClient.patch<SmsCredentialResponse>(`/api/admin/sms/credentials/${credentialId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.smsCredentials.all });
    },
  });
}

export function useDeleteAdminSmsCredentialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentialId: number) => apiClient.delete<void>(`/api/admin/sms/credentials/${credentialId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.smsCredentials.all });
    },
  });
}

export function useAdminInvoiceSmsTemplatesQuery(params: SmsListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.invoiceSmsTemplates.list(params.page, params.perPage, params.search.trim(), params.status.trim()),
    queryFn: () =>
      apiClient.get<InvoiceSmsTemplatesResponse>(buildListPath("/api/admin/invoice-sms-templates", params), {
        skipAuthRedirect: true,
      }),
    enabled,
    retry: false,
  });
}

export function useAdminInvoiceSmsTemplateOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.invoiceSmsTemplates.options,
    queryFn: () => apiClient.get<InvoiceSmsTemplateOptionsResponse>("/api/admin/invoice-sms-templates/options", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useAdminInvoiceSmsVariablesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.invoiceSmsTemplates.variables,
    queryFn: () => apiClient.get<InvoiceSmsVariablesResponse>("/api/admin/invoice-sms-templates/variables", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useCreateAdminInvoiceSmsTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InvoiceSmsTemplatePayload) =>
      apiClient.post<InvoiceSmsTemplateResponse>("/api/admin/invoice-sms-templates", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.invoiceSmsTemplates.all });
    },
  });
}

export function useUpdateAdminInvoiceSmsTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: number; payload: InvoiceSmsTemplatePayload }) =>
      apiClient.patch<InvoiceSmsTemplateResponse>(`/api/admin/invoice-sms-templates/${templateId}`, payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.invoiceSmsTemplates.all });
    },
  });
}

export function useDeleteAdminInvoiceSmsTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: number) => apiClient.delete<void>(`/api/admin/invoice-sms-templates/${templateId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.invoiceSmsTemplates.all });
    },
  });
}

export function useAdminInvoiceSmsLogsQuery(params: SmsListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.invoiceSmsLogs.list(params.page, params.perPage, params.search.trim(), params.status.trim()),
    queryFn: () =>
      apiClient.get<InvoiceSmsLogsResponse>(buildListPath("/api/admin/invoice-sms-logs", params), {
        skipAuthRedirect: true,
      }),
    enabled,
    retry: false,
  });
}
