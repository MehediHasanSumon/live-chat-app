"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { type CompanyLogoObject } from "@/lib/hooks/use-admin-company-settings";
import { queryKeys } from "@/lib/query-keys";

export type PublicCompanySetting = {
  id: number | null;
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
  status: "active" | "inactive";
  created_at: string | null;
  updated_at: string | null;
};

type PublicCompanySettingResponse = {
  data: PublicCompanySetting;
};

export function usePublicCompanySettingQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.public.companySettings,
    queryFn: () => apiClient.get<PublicCompanySettingResponse>("/api/public/company-settings", { skipAuthRedirect: true }),
    enabled,
    retry: false,
    staleTime: 60_000,
    select: (response) => response.data,
  });
}
