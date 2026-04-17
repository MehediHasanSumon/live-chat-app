"use client";

import { FormEvent, ReactNode, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, PencilLine, Plus, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { BoneyardSkeleton, TableSkeleton } from "@/components/ui/boneyard-loading";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { FileInput } from "@/components/ui/file-input";
import { Pagination } from "@/components/ui/pagination";
import { SelectInput, SelectInputOption } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import {
  AdminCompanySettingRecord,
  AdminCompanySettingStatus,
  useAdminCompanySettingsQuery,
  useCreateAdminCompanySettingMutation,
  useDeleteAdminCompanySettingMutation,
  useUploadCompanyLogoMutation,
  useUpdateAdminCompanySettingMutation,
} from "@/lib/hooks/use-admin-company-settings";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];
const COMPANY_STATUSES: AdminCompanySettingStatus[] = ["active", "inactive"];
const mobilePattern = /^[0-9+\-\s()]+$/;

const STATUS_OPTIONS: SelectInputOption[] = COMPANY_STATUSES.map((status) => ({ value: status, label: titleCase(status) }));
const CURRENCY_OPTIONS: SelectInputOption[] = ["BDT", "USD", "EUR", "INR"].map((currency) => ({ value: currency, label: currency }));

type CompanySettingFormState = {
  company_name: string;
  company_details: string;
  proprietor_name: string;
  company_address: string;
  factory_address: string;
  company_mobile: string;
  company_phone: string;
  company_email: string;
  trade_license: string;
  tin_no: string;
  bin_no: string;
  vat_no: string;
  vat_rate: string;
  currency: string;
  company_logo: string;
  company_logo_name: string;
  is_registration_enable: boolean;
  is_email_verification_enable: boolean;
  status: AdminCompanySettingStatus;
};

type TextFieldKey = {
  [K in keyof CompanySettingFormState]: CompanySettingFormState[K] extends string ? K : never;
}[keyof CompanySettingFormState];

type TextFieldConfig = {
  key: TextFieldKey;
  label: string;
  placeholder: string;
  className?: string;
  inputType?: string;
};

const IDENTITY_FIELDS: TextFieldConfig[] = [
  { key: "company_name", label: "Company Name", placeholder: "Nexus Fuel Station", className: "md:col-span-2" },
  { key: "proprietor_name", label: "Proprietor Name", placeholder: "Rahim Uddin" },
  { key: "company_mobile", label: "Mobile", placeholder: "+8801700000000" },
  { key: "company_phone", label: "Phone", placeholder: "02-123456" },
  { key: "company_email", label: "Email", placeholder: "office@example.com", inputType: "email" },
];

const EXTENDED_TEXT_FIELDS: TextFieldConfig[] = [
  { key: "company_details", label: "Company Details", placeholder: "Retail fuel and lubricant sales." },
  { key: "company_address", label: "Company Address", placeholder: "Dhaka, Bangladesh" },
  { key: "factory_address", label: "Factory Address", placeholder: "Gazipur, Bangladesh" },
];

const COMPLIANCE_FIELDS: TextFieldConfig[] = [
  { key: "trade_license", label: "Trade License", placeholder: "TL-1001" },
  { key: "tin_no", label: "TIN No", placeholder: "TIN-1001" },
  { key: "bin_no", label: "BIN No", placeholder: "BIN-1001" },
  { key: "vat_no", label: "VAT No", placeholder: "VAT-1001" },
  { key: "vat_rate", label: "VAT Rate", placeholder: "7.50", inputType: "number" },
];

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createEmptyForm(): CompanySettingFormState {
  return {
    company_name: "",
    company_details: "",
    proprietor_name: "",
    company_address: "",
    factory_address: "",
    company_mobile: "",
    company_phone: "",
    company_email: "",
    trade_license: "",
    tin_no: "",
    bin_no: "",
    vat_no: "",
    vat_rate: "0",
    currency: "BDT",
    company_logo: "",
    company_logo_name: "",
    is_registration_enable: false,
    is_email_verification_enable: true,
    status: "active",
  };
}

function createFormFromRecord(record: AdminCompanySettingRecord): CompanySettingFormState {
  return {
    company_name: record.company_name,
    company_details: record.company_details ?? "",
    proprietor_name: record.proprietor_name ?? "",
    company_address: record.company_address ?? "",
    factory_address: record.factory_address ?? "",
    company_mobile: record.company_mobile ?? "",
    company_phone: record.company_phone ?? "",
    company_email: record.company_email ?? "",
    trade_license: record.trade_license ?? "",
    tin_no: record.tin_no ?? "",
    bin_no: record.bin_no ?? "",
    vat_no: record.vat_no ?? "",
    vat_rate: record.vat_rate,
    currency: record.currency,
    company_logo: record.company_logo ?? "",
    company_logo_name: record.company_logo_object?.original_name ?? "",
    is_registration_enable: record.is_registration_enable,
    is_email_verification_enable: record.is_email_verification_enable,
    status: record.status,
  };
}

function parsePageParam(value: string | null) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE;
}

function parsePerPageParam(value: string | null) {
  const perPage = Number(value);

  return PER_PAGE_OPTIONS.includes(perPage) ? perPage : DEFAULT_PER_PAGE;
}

function nullableTrim(value: string) {
  return value.trim() || null;
}

function CompanySettingsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = (searchParams.get("search") ?? "").trim();
  const { data: companySettingsResponse, isLoading, error } = useAdminCompanySettingsQuery({ page, perPage, search }, true);
  const companySettings = companySettingsResponse?.data ?? [];
  const paginationMeta = companySettingsResponse?.meta;
  const createCompanySetting = useCreateAdminCompanySettingMutation();
  const updateCompanySetting = useUpdateAdminCompanySettingMutation();
  const deleteCompanySetting = useDeleteAdminCompanySettingMutation();
  const uploadCompanyLogo = useUploadCompanyLogoMutation();
  const [searchDraft, setSearchDraft] = useState(search);
  const [form, setForm] = useState<CompanySettingFormState>(() => createEmptyForm());
  const [editingCompanySetting, setEditingCompanySetting] = useState<AdminCompanySettingRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCompanySettingSectionOpen, setIsCompanySettingSectionOpen] = useState(false);
  const isSubmitting = createCompanySetting.isPending || updateCompanySetting.isPending || uploadCompanyLogo.isPending;
  const isTableBusy = deleteCompanySetting.isPending;

  const updatePaginationUrl = useCallback(
    (nextPage: number, nextPerPage = perPage) => {
      const params = new URLSearchParams(searchParams.toString());
      const normalizedPage = Math.max(1, nextPage);

      if (normalizedPage === DEFAULT_PAGE) {
        params.delete("page");
      } else {
        params.set("page", String(normalizedPage));
      }

      if (nextPerPage === DEFAULT_PER_PAGE) {
        params.delete("per_page");
      } else {
        params.set("per_page", String(nextPerPage));
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, perPage, router, searchParams],
  );

  const updateSearchUrl = useCallback(
    (nextSearch: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const normalizedSearch = nextSearch.trim();

      params.delete("page");
      if (normalizedSearch) {
        params.set("search", normalizedSearch);
      } else {
        params.delete("search");
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    if (paginationMeta && page > paginationMeta.last_page) {
      updatePaginationUrl(paginationMeta.last_page, perPage);
    }
  }, [page, paginationMeta, perPage, updatePaginationUrl]);

  function updateFormValue<K extends keyof CompanySettingFormState>(key: K, value: CompanySettingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function closeCompanySettingSection() {
    setIsCompanySettingSectionOpen(false);
    setForm(createEmptyForm());
    setEditingCompanySetting(null);
    setFormError(null);
  }

  function openCreateSection() {
    setIsCompanySettingSectionOpen(true);
    setForm(createEmptyForm());
    setEditingCompanySetting(null);
    setFormError(null);
  }

  function openEditSection(companySetting: AdminCompanySettingRecord) {
    setEditingCompanySetting(companySetting);
    setForm(createFormFromRecord(companySetting));
    setFormError(null);
    setIsCompanySettingSectionOpen(true);
  }

  async function handleLogoUpload(file: File | null) {
    setFormError(null);

    if (!file) {
      updateFormValue("company_logo", "");
      updateFormValue("company_logo_name", "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFormError("Company logo must be an image file.");
      return;
    }

    try {
      const response = await uploadCompanyLogo.mutateAsync(file);
      updateFormValue("company_logo", response.data.object_uuid);
      updateFormValue("company_logo_name", response.data.original_name);
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(submissionError.errors?.file?.[0] ?? submissionError.message);
        return;
      }

      setFormError("Unable to upload the company logo right now.");
    }
  }

  function validateForm() {
    const companyName = form.company_name.trim();
    const vatRate = Number(form.vat_rate);

    if (!companyName) return "Company name is required.";
    if (companyName.length > 160) return "Company name must be 160 characters or fewer.";
    if (form.company_details.length > 2000 || form.company_address.length > 2000 || form.factory_address.length > 2000) {
      return "Details and address fields must be 2000 characters or fewer.";
    }
    if (form.proprietor_name.length > 120) return "Proprietor name must be 120 characters or fewer.";
    if (form.company_mobile.length > 20 || form.company_phone.length > 30) return "Mobile or phone number is too long.";
    if ((form.company_mobile && !mobilePattern.test(form.company_mobile)) || (form.company_phone && !mobilePattern.test(form.company_phone))) {
      return "Phone numbers can only contain numbers, spaces, plus, dashes, and brackets.";
    }
    if (form.company_email.length > 120) return "Company email must be 120 characters or fewer.";
    if (form.company_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.company_email)) return "Company email is invalid.";
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return "VAT rate must be between 0 and 100.";
    if (!form.currency.trim() || form.currency.length > 10) return "Currency is required and must be 10 characters or fewer.";
    if (form.company_logo.length > 2048) return "Company logo reference must be 2048 characters or fewer.";
    if (!COMPANY_STATUSES.includes(form.status)) return "Status is invalid.";

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientError = validateForm();
    if (clientError) {
      setFormError(clientError);
      return;
    }

    const payload = {
      company_name: form.company_name.trim(),
      company_details: nullableTrim(form.company_details),
      proprietor_name: nullableTrim(form.proprietor_name),
      company_address: nullableTrim(form.company_address),
      factory_address: nullableTrim(form.factory_address),
      company_mobile: nullableTrim(form.company_mobile),
      company_phone: nullableTrim(form.company_phone),
      company_email: nullableTrim(form.company_email),
      trade_license: nullableTrim(form.trade_license),
      tin_no: nullableTrim(form.tin_no),
      bin_no: nullableTrim(form.bin_no),
      vat_no: nullableTrim(form.vat_no),
      vat_rate: Number(form.vat_rate),
      currency: form.currency.trim(),
      company_logo: nullableTrim(form.company_logo),
      is_registration_enable: form.is_registration_enable,
      is_email_verification_enable: form.is_email_verification_enable,
      status: form.status,
    };

    try {
      if (editingCompanySetting) {
        await updateCompanySetting.mutateAsync({ companySettingId: editingCompanySetting.id, payload });
      } else {
        await createCompanySetting.mutateAsync(payload);
      }

      closeCompanySettingSection();
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.company_name?.[0] ??
            submissionError.errors?.company_email?.[0] ??
            submissionError.errors?.company_mobile?.[0] ??
            submissionError.errors?.company_phone?.[0] ??
            submissionError.errors?.vat_rate?.[0] ??
            submissionError.errors?.currency?.[0] ??
            submissionError.errors?.status?.[0] ??
            submissionError.message,
        );
        return;
      }

      setFormError("Unable to save the company setting right now.");
    }
  }

  async function handleDelete(companySetting: AdminCompanySettingRecord) {
    if (!window.confirm(`Delete company setting "${companySetting.company_name}"?`)) return;

    setFormError(null);

    try {
      await deleteCompanySetting.mutateAsync(companySetting.id);
      if (editingCompanySetting?.id === companySetting.id) closeCompanySettingSection();
    } catch (submissionError) {
      setFormError(submissionError instanceof ApiClientError ? submissionError.message : "Unable to delete the company setting right now.");
    }
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Company Settings</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Manage company identity, compliance, VAT, and registration options.</p>
          </div>
          <Button
            className="gap-2 self-start rounded-full px-5 sm:self-center"
            aria-controls="company-setting-form-section"
            aria-expanded={isCompanySettingSectionOpen}
            onClick={() => (isCompanySettingSectionOpen ? closeCompanySettingSection() : openCreateSection())}
          >
            {isCompanySettingSectionOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isCompanySettingSectionOpen ? "Close" : "Create Company"}
          </Button>
        </div>
      </section>

      <CompanySettingForm
        form={form}
        formError={formError}
        isOpen={isCompanySettingSectionOpen}
        isSubmitting={isSubmitting}
        isEditing={Boolean(editingCompanySetting)}
        onCancel={closeCompanySettingSection}
        onSubmit={handleSubmit}
        onUpdate={updateFormValue}
        onLogoUpload={(file) => void handleLogoUpload(file)}
      />

      <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-5 sm:px-8">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); updateSearchUrl(searchDraft); }}>
          <Field label="Search" className="flex-1">
            <TextInput
              placeholder="Search company, proprietor, email, mobile, TIN, BIN, VAT"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full px-5" disabled={isTableBusy}>Search</Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
              disabled={isTableBusy || (!search && !searchDraft)}
              onClick={() => { setSearchDraft(""); updateSearchUrl(""); }}
            >
              Clear
            </Button>
          </div>
        </form>
      </section>

      {error ? (
        <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-5 text-sm text-rose-600 sm:px-8">
          Unable to load company settings right now.
        </section>
      ) : (
        <CompanySettingsTable
          companySettings={companySettings}
          isLoading={isLoading}
          isTableBusy={isTableBusy}
          page={page}
          perPage={perPage}
          paginationMeta={paginationMeta}
          search={search}
          onDelete={handleDelete}
          onEdit={openEditSection}
          onPageChange={(nextPage) => updatePaginationUrl(nextPage)}
          onPerPageChange={(nextPerPage) => updatePaginationUrl(DEFAULT_PAGE, nextPerPage)}
        />
      )}
    </main>
  );
}

function CompanySettingForm({
  form,
  formError,
  isEditing,
  isOpen,
  isSubmitting,
  onCancel,
  onSubmit,
  onUpdate,
  onLogoUpload,
}: {
  form: CompanySettingFormState;
  formError: string | null;
  isEditing: boolean;
  isOpen: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof CompanySettingFormState>(key: K, value: CompanySettingFormState[K]) => void;
  onLogoUpload: (file: File | null) => void;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1328px] overflow-hidden transition-all duration-300 ease-out", isOpen ? "mt-5 max-h-[1900px] translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-2 opacity-0")}>
      <section id="company-setting-form-section" aria-hidden={!isOpen} className="glass-card overflow-visible rounded-[1.5rem]">
        <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
          <h2 className="text-xl font-semibold text-[#1f2440]">{isEditing ? "Edit Company" : "Create Company"}</h2>
        </div>
        <form onSubmit={onSubmit}>
          <div className="space-y-6 px-6 py-6 sm:px-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {IDENTITY_FIELDS.map((field) => (
                <TextFormField key={field.key} field={field} form={form} disabled={!isOpen || isSubmitting} onUpdate={onUpdate} />
              ))}
              <Field label="Currency">
                <SelectInput value={form.currency} options={CURRENCY_OPTIONS} dropdownLabel="Currency" onChange={(value) => onUpdate("currency", value)} disabled={!isOpen || isSubmitting} />
              </Field>
              <Field label="Status">
                <SelectInput value={form.status} options={STATUS_OPTIONS} dropdownLabel="Status" onChange={(value) => onUpdate("status", value as AdminCompanySettingStatus)} disabled={!isOpen || isSubmitting} />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {EXTENDED_TEXT_FIELDS.map((field) => (
                <TextFormField key={field.key} field={field} form={form} disabled={!isOpen || isSubmitting} onUpdate={onUpdate} />
              ))}
              <Field label="Company Logo">
                <FileInput
                  accept="image/*"
                  disabled={!isOpen || isSubmitting}
                  onChange={(event) => onLogoUpload(event.target.files?.[0] ?? null)}
                />
                {form.company_logo ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                    <span className="max-w-full truncate">Uploaded: {form.company_logo_name || form.company_logo}</span>
                    <button
                      type="button"
                      className="font-semibold text-[var(--accent)]"
                      disabled={!isOpen || isSubmitting}
                      onClick={() => {
                        onUpdate("company_logo", "");
                        onUpdate("company_logo_name", "");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </Field>
            </div>

            <div className="border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold text-[#2d3150]">Compliance</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {COMPLIANCE_FIELDS.map((field) => (
                  <TextFormField key={field.key} field={field} form={form} disabled={!isOpen || isSubmitting} onUpdate={onUpdate} />
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--line)] pt-5">
              <h3 className="text-sm font-semibold text-[#2d3150]">Account Options</h3>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                <CheckboxField label="Registration Enable" checked={form.is_registration_enable} disabled={!isOpen || isSubmitting} onChange={(checked) => onUpdate("is_registration_enable", checked)} />
                <CheckboxField label="Email Verification Enable" checked={form.is_email_verification_enable} disabled={!isOpen || isSubmitting} onChange={(checked) => onUpdate("is_email_verification_enable", checked)} />
              </div>
            </div>

            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] px-6 py-5 sm:px-8">
            <Button type="button" variant="ghost" className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white" onClick={onCancel} disabled={!isOpen || isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-full px-5" disabled={!isOpen || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TextFormField({
  disabled,
  field,
  form,
  onUpdate,
}: {
  disabled: boolean;
  field: TextFieldConfig;
  form: CompanySettingFormState;
  onUpdate: <K extends keyof CompanySettingFormState>(key: K, value: CompanySettingFormState[K]) => void;
}) {
  return (
    <Field label={field.label} className={field.className}>
      <TextInput
        type={field.inputType ?? "text"}
        min={field.key === "vat_rate" ? "0" : undefined}
        max={field.key === "vat_rate" ? "100" : undefined}
        step={field.key === "vat_rate" ? "0.01" : undefined}
        placeholder={field.placeholder}
        value={form[field.key]}
        onChange={(event) => onUpdate(field.key, event.target.value)}
        autoComplete="off"
        disabled={disabled}
      />
    </Field>
  );
}

function CheckboxField({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-[#2d3150]">
      <CheckboxInput checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function CompanySettingsTable({
  companySettings,
  isLoading,
  isTableBusy,
  onDelete,
  onEdit,
  onPageChange,
  onPerPageChange,
  page,
  paginationMeta,
  perPage,
  search,
}: {
  companySettings: AdminCompanySettingRecord[];
  isLoading: boolean;
  isTableBusy: boolean;
  onDelete: (companySetting: AdminCompanySettingRecord) => void;
  onEdit: (companySetting: AdminCompanySettingRecord) => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  page: number;
  paginationMeta: { current_page: number; from: number | null; last_page: number; per_page: number; to: number | null; total: number } | undefined;
  perPage: number;
  search: string;
}) {
  return (
    <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
      {isLoading ? (
        <BoneyardSkeleton name="company-settings-table" loading={isLoading} fallback={<TableSkeleton columns={6} rows={6} />}>
          <TableSkeleton columns={6} rows={6} />
        </BoneyardSkeleton>
      ) : companySettings.length === 0 ? (
        <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">
          {search ? "No company settings matched your search." : "No company settings found yet."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {["#", "Company Name", "Proprietor Name", "Mobile", "Status"].map((heading, index) => (
                  <th key={heading} className={cn("px-6 py-4 font-semibold", index === 0 && "sm:px-8")}>{heading}</th>
                ))}
                <th className="px-6 py-4 font-semibold sm:px-8"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {companySettings.map((companySetting, index) => (
                <CompanySettingRow
                  key={companySetting.id}
                  companySetting={companySetting}
                  index={(page - 1) * perPage + index + 1}
                  isTableBusy={isTableBusy}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              ))}
            </tbody>
          </table>
          </div>
          {paginationMeta ? (
            <Pagination
              meta={paginationMeta}
              disabled={isTableBusy}
              perPageOptions={PER_PAGE_OPTIONS}
              onPageChange={onPageChange}
              onPerPageChange={onPerPageChange}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function CompanySettingRow({
  companySetting,
  index,
  isTableBusy,
  onDelete,
  onEdit,
}: {
  companySetting: AdminCompanySettingRecord;
  index: number;
  isTableBusy: boolean;
  onDelete: (companySetting: AdminCompanySettingRecord) => void;
  onEdit: (companySetting: AdminCompanySettingRecord) => void;
}) {
  return (
    <tr className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{index}</td>
      <td className="px-6 py-4">
        <p className="min-w-[220px] font-medium text-[#2d3150]">{companySetting.company_name}</p>
      </td>
      <td className="px-6 py-4 text-[var(--muted)]">{companySetting.proprietor_name ?? "-"}</td>
      <td className="px-6 py-4 text-[var(--muted)]">{companySetting.company_mobile ?? "-"}</td>
      <td className="px-6 py-4"><StatusBadge status={companySetting.status} /></td>
      <td className="px-6 py-4 sm:px-8">
        <div className="flex justify-end gap-2">
          <Link
            href={`/company-settings/${companySetting.id}`}
            aria-label="Company details"
            title="Details"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-white text-xs font-medium text-[var(--foreground)] transition hover:bg-white"
          >
            <Eye className="h-3.5 w-3.5" />
          </Link>
          <Button as="span" variant="outline" size="icon-sm" aria-label="Edit company" title="Edit" disabled={isTableBusy} onClick={() => onEdit(companySetting)}>
            <PencilLine className="h-3.5 w-3.5" />
          </Button>
          <Button as="span" variant="danger-soft" size="icon-sm" aria-label="Delete company" title="Delete" disabled={isTableBusy} onClick={() => onDelete(companySetting)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: AdminCompanySettingStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", status === "active" && "bg-emerald-50 text-emerald-700", status === "inactive" && "bg-rose-50 text-rose-700")}>
      {status}
    </span>
  );
}

function Field({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-semibold text-[#2d3150]">{label}</label>
      {children}
    </div>
  );
}

function CompanySettingsPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Company Settings</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Manage company identity, compliance, VAT, and registration options.</p>
        </div>
      </section>
    </main>
  );
}

export default function CompanySettingsPage() {
  return (
    <Suspense fallback={<CompanySettingsPageFallback />}>
      <CompanySettingsPageContent />
    </Suspense>
  );
}
