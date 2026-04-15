"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AdminCompanySettingStatus = "active" | "inactive";

export type AdminCompanySettingRecord = {
  id: number;
  company_name: string;
  company_details: string | null;
  proprietor_name: string | null;
  company_address: string | null;
  factory_address: string | null;
  company_mobile: string | null;
  company_phone: string | null;
  company_email: string | null;
  trade_license: string | null;
  tin_no: string | null;
  bin_no: string | null;
  vat_no: string | null;
  vat_rate: string;
  currency: string;
  company_logo: string | null;
  company_logo_object: CompanyLogoObject | null;
  is_registration_enable: boolean;
  is_email_verification_enable: boolean;
  status: AdminCompanySettingStatus;
  created_at: string | null;
  updated_at: string | null;
};

export type CompanyLogoObject = {
  id: number;
  object_uuid: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  download_url: string | null;
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

export type CompanySettingsResponse = {
  data: AdminCompanySettingRecord[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

type CompanySettingResponse = {
  data: AdminCompanySettingRecord;
};

type CompanyLogoUploadResponse = {
  data: CompanyLogoObject;
};

export type CompanySettingPayload = {
  company_name: string;
  company_details: string | null;
  proprietor_name: string | null;
  company_address: string | null;
  factory_address: string | null;
  company_mobile: string | null;
  company_phone: string | null;
  company_email: string | null;
  trade_license: string | null;
  tin_no: string | null;
  bin_no: string | null;
  vat_no: string | null;
  vat_rate: number;
  currency: string;
  company_logo: string | null;
  is_registration_enable: boolean;
  is_email_verification_enable: boolean;
  status: AdminCompanySettingStatus;
};

type CompanySettingListParams = {
  page: number;
  perPage: number;
  search: string;
};

function buildCompanySettingsPath({ page, perPage, search }: CompanySettingListParams) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  return `/api/admin/company-settings?${params.toString()}`;
}

export function useAdminCompanySettingsQuery(params: CompanySettingListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.companySettings.list(params.page, params.perPage, params.search.trim()),
    queryFn: () => apiClient.get<CompanySettingsResponse>(buildCompanySettingsPath(params), { skipAuthRedirect: true }),
    enabled,
    retry: false,
  });
}

export function useAdminCompanySettingQuery(companySettingId: number | string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.companySettings.detail(companySettingId),
    queryFn: () => apiClient.get<CompanySettingResponse>(`/api/admin/company-settings/${companySettingId}`, { skipAuthRedirect: true }),
    enabled,
    retry: false,
    select: (response) => response.data,
  });
}

export function useCreateAdminCompanySettingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CompanySettingPayload) =>
      apiClient.post<CompanySettingResponse>("/api/admin/company-settings", payload, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.companySettings.all });
    },
  });
}

export function useUpdateAdminCompanySettingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companySettingId, payload }: { companySettingId: number; payload: CompanySettingPayload }) =>
      apiClient.patch<CompanySettingResponse>(`/api/admin/company-settings/${companySettingId}`, payload, {
        skipAuthRedirect: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.companySettings.all });
    },
  });
}

export function useDeleteAdminCompanySettingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (companySettingId: number) =>
      apiClient.delete<void>(`/api/admin/company-settings/${companySettingId}`, { skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.companySettings.all });
    },
  });
}

export function useUploadCompanyLogoMutation() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "company_logo");

      return apiClient.post<CompanyLogoUploadResponse>("/api/uploads", formData, {
        requiresCsrf: true,
        skipAuthRedirect: true,
      });
    },
  });
}
