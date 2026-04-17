"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { FileText, PencilLine, Plus, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PdfDownloadButton } from "@/components/ui/pdf-download-button";
import { Button } from "@/components/ui/button";
import { BoneyardSkeleton, TableSkeleton } from "@/components/ui/boneyard-loading";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { Pagination } from "@/components/ui/pagination";
import { SelectInput, SelectInputOption } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { buildAdminListPdfPath } from "@/lib/admin-pdf";
import { ApiClientError } from "@/lib/api-client";
import {
  AdminSmsStatus,
  InvoiceSmsTemplateRecord,
  useAdminInvoiceSmsTemplatesQuery,
  useAdminInvoiceSmsVariablesQuery,
  useCreateAdminInvoiceSmsTemplateMutation,
  useDeleteAdminInvoiceSmsTemplateMutation,
  useUpdateAdminInvoiceSmsTemplateMutation,
} from "@/lib/hooks/use-admin-sms";
import { usePdfDownload } from "@/lib/hooks/use-pdf-download";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];
const STATUS_OPTIONS: SelectInputOption[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];
const FORM_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) => option.value !== "");

type TemplateFormState = {
  name: string;
  body: string;
  variables_json: string[];
  status: AdminSmsStatus;
  is_default: boolean;
};

function createEmptyForm(): TemplateFormState {
  return {
    name: "",
    body: "",
    variables_json: [],
    status: "active",
    is_default: false,
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function parsePageParam(value: string | null) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE;
}

function parsePerPageParam(value: string | null) {
  const perPage = Number(value);

  return PER_PAGE_OPTIONS.includes(perPage) ? perPage : DEFAULT_PER_PAGE;
}

function InvoiceSmsTemplatesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = (searchParams.get("search") ?? "").trim();
  const status = (searchParams.get("status") ?? "").trim();
  const { data: templatesResponse, isLoading, error } = useAdminInvoiceSmsTemplatesQuery({ page, perPage, search, status }, true);
  const { data: variables = [] } = useAdminInvoiceSmsVariablesQuery(true);
  const templates = templatesResponse?.data ?? [];
  const paginationMeta = templatesResponse?.meta;
  const createTemplate = useCreateAdminInvoiceSmsTemplateMutation();
  const updateTemplate = useUpdateAdminInvoiceSmsTemplateMutation();
  const deleteTemplate = useDeleteAdminInvoiceSmsTemplateMutation();
  const [searchDraft, setSearchDraft] = useState(search);
  const [statusDraft, setStatusDraft] = useState(status);
  const [form, setForm] = useState<TemplateFormState>(() => createEmptyForm());
  const [editingTemplate, setEditingTemplate] = useState<InvoiceSmsTemplateRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const { download, downloadError, isDownloadingPdf } = usePdfDownload();
  const isSubmitting = createTemplate.isPending || updateTemplate.isPending;
  const allowedVariables = variables.map((variable) => variable.key);

  const updateListUrl = useCallback(
    (next: { page?: number; perPage?: number; search?: string; status?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextPage = next.page ?? page;
      const nextPerPage = next.perPage ?? perPage;
      const nextSearch = (next.search ?? search).trim();
      const nextStatus = (next.status ?? status).trim();

      if (nextPage === DEFAULT_PAGE) params.delete("page");
      else params.set("page", String(nextPage));

      if (nextPerPage === DEFAULT_PER_PAGE) params.delete("per_page");
      else params.set("per_page", String(nextPerPage));

      if (nextSearch) params.set("search", nextSearch);
      else params.delete("search");

      if (nextStatus) params.set("status", nextStatus);
      else params.delete("status");

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [page, pathname, perPage, router, search, searchParams, status],
  );

  useEffect(() => {
    if (paginationMeta && page > paginationMeta.last_page) {
      updateListUrl({ page: paginationMeta.last_page });
    }
  }, [page, paginationMeta, updateListUrl]);

  function updateFormValue<K extends keyof TemplateFormState>(key: K, value: TemplateFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingTemplate(null);
    setForm(createEmptyForm());
    setFormError(null);
  }

  function openCreateForm() {
    setIsFormOpen(true);
    setEditingTemplate(null);
    setForm(createEmptyForm());
    setFormError(null);
  }

  function openEditForm(template: InvoiceSmsTemplateRecord) {
    setIsFormOpen(true);
    setEditingTemplate(template);
    setForm({
      name: template.name,
      body: template.body,
      variables_json: template.variables_json ?? [],
      status: template.status,
      is_default: template.is_default,
    });
    setFormError(null);
  }

  function toggleVariable(key: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      variables_json: checked
        ? Array.from(new Set([...current.variables_json, key]))
        : current.variables_json.filter((variable) => variable !== key),
    }));
  }

  function appendToken(token: string) {
    setForm((current) => ({
      ...current,
      body: current.body ? `${current.body} ${token}` : token,
    }));
  }

  function validateForm() {
    const name = form.name.trim();
    const body = form.body.trim();

    if (!name) return "Template name is required.";
    if (name.length > 120) return "Template name must be 120 characters or fewer.";
    if (!body) return "SMS body is required.";
    if (body.length > 1000) return "SMS body must be 1000 characters or fewer.";
    if (!["active", "inactive"].includes(form.status)) return "Status is invalid.";
    if (form.variables_json.some((variable) => !allowedVariables.includes(variable))) return "One or more variables are invalid.";

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
      name: form.name.trim(),
      body: form.body.trim(),
      variables_json: form.variables_json.length > 0 ? form.variables_json : null,
      status: form.status,
      is_default: form.is_default,
    };

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({ templateId: editingTemplate.id, payload });
      } else {
        await createTemplate.mutateAsync(payload);
      }

      closeForm();
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.name?.[0] ??
            submissionError.errors?.body?.[0] ??
            submissionError.errors?.variables_json?.[0] ??
            submissionError.errors?.status?.[0] ??
            submissionError.errors?.is_default?.[0] ??
            submissionError.message,
        );
        return;
      }

      setFormError("Unable to save SMS template right now.");
    }
  }

  async function handleDelete(template: InvoiceSmsTemplateRecord) {
    if (!window.confirm(`Delete SMS template "${template.name}"?`)) {
      return;
    }

    setFormError(null);

    try {
      setDeletingTemplateId(template.id);
      await deleteTemplate.mutateAsync(template.id);
      if (editingTemplate?.id === template.id) closeForm();
    } catch (submissionError) {
      setFormError(submissionError instanceof ApiClientError ? submissionError.message : "Unable to delete SMS template right now.");
    } finally {
      setDeletingTemplateId(null);
    }
  }

  async function handleDownloadPdf() {
    await download(buildAdminListPdfPath("invoice-sms-templates", { search, status }), "invoice-sms-templates");
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Invoice SMS Templates</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Create reusable SMS copy for invoice notifications.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PdfDownloadButton isLoading={isDownloadingPdf} onClick={() => void handleDownloadPdf()} />
            <Button className="gap-2 self-start rounded-full px-5 sm:self-center" aria-controls="invoice-sms-template-form-section" aria-expanded={isFormOpen} onClick={() => (isFormOpen ? closeForm() : openCreateForm())}>
              {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isFormOpen ? "Close" : "Create Template"}
            </Button>
          </div>
        </div>
      </section>

      {downloadError ? <p className="mx-auto mt-3 w-full max-w-[1328px] text-sm text-rose-600">{downloadError}</p> : null}

      <div className={cn("mx-auto w-full max-w-[1328px] overflow-hidden transition-all duration-300 ease-out", isFormOpen ? "mt-5 max-h-[1200px] translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-2 opacity-0")}>
        <section id="invoice-sms-template-form-section" aria-hidden={!isFormOpen} className="glass-card overflow-visible rounded-[1.5rem]">
          <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
            <h2 className="text-xl font-semibold text-[#1f2440]">{editingTemplate ? "Edit Template" : "Create Template"}</h2>
          </div>
          <form onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-5 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.9fr)]">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Template Name</label>
                  <TextInput placeholder="Invoice confirmation" value={form.name} onChange={(event) => updateFormValue("name", event.target.value)} disabled={!isFormOpen || isSubmitting} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">SMS Body</label>
                  <textarea
                    className="pill-input min-h-40 w-full resize-none px-3 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                    placeholder="Dear {customer_name}, invoice {invoice_no} total {total_amount}."
                    value={form.body}
                    onChange={(event) => updateFormValue("body", event.target.value)}
                    disabled={!isFormOpen || isSubmitting}
                  />
                  <p className="mt-2 text-xs text-[var(--muted)]">{form.body.length}/1000 characters</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Status</label>
                    <SelectInput value={form.status} options={FORM_STATUS_OPTIONS} dropdownLabel="Status" onChange={(value) => updateFormValue("status", value as AdminSmsStatus)} disabled={!isFormOpen || isSubmitting} />
                  </div>
                  <label className="mt-7 flex items-center gap-2 text-sm font-medium text-[#2d3150]">
                    <CheckboxInput checked={form.is_default} disabled={!isFormOpen || isSubmitting} onChange={(event) => updateFormValue("is_default", event.target.checked)} />
                    Use as default template
                  </label>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-white/70 p-4">
                <p className="text-sm font-semibold text-[#2d3150]">Dynamic Variables</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Select variables used by the template. Click a token to add it to the message.</p>
                <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {variables.map((variable) => (
                    <div key={variable.key} className="rounded-lg border border-[var(--line)] bg-white px-3 py-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-[#2d3150]">
                        <CheckboxInput checked={form.variables_json.includes(variable.key)} disabled={!isFormOpen || isSubmitting} onChange={(event) => toggleVariable(variable.key, event.target.checked)} />
                        {variable.key}
                      </label>
                      <button type="button" className="mt-2 text-xs font-semibold text-[var(--accent)]" disabled={!isFormOpen || isSubmitting} onClick={() => appendToken(variable.token)}>
                        {variable.token}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {formError ? <p className="text-sm text-rose-600 lg:col-span-2">{formError}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] px-6 py-5 sm:px-8">
              <Button type="button" variant="ghost" className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white" onClick={closeForm} disabled={!isFormOpen || isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-5" disabled={!isFormOpen || isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </section>
      </div>

      <section className="glass-card relative z-30 mx-auto mt-5 w-full max-w-[1328px] overflow-visible rounded-[1.5rem] px-6 py-5 sm:px-8">
        <form className="flex flex-col gap-3 lg:flex-row lg:items-end" onSubmit={(event) => { event.preventDefault(); updateListUrl({ page: DEFAULT_PAGE, search: searchDraft, status: statusDraft }); }}>
          <div className="flex-1">
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Search</label>
            <TextInput placeholder="Search name or body" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
          </div>
          <div className="w-full lg:w-56">
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Status</label>
            <SelectInput value={statusDraft} options={STATUS_OPTIONS} dropdownLabel="Status" onChange={setStatusDraft} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full px-5">Search</Button>
            <Button type="button" variant="ghost" className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white" disabled={!search && !searchDraft && !status && !statusDraft} onClick={() => { setSearchDraft(""); setStatusDraft(""); updateListUrl({ page: DEFAULT_PAGE, search: "", status: "" }); }}>
              Clear
            </Button>
          </div>
        </form>
      </section>

      {error ? (
        <section className="glass-card relative z-0 mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-5 text-sm text-rose-600 sm:px-8">Unable to load SMS templates right now.</section>
      ) : (
        <section className="glass-card relative z-0 mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
          {isLoading ? (
            <BoneyardSkeleton name="invoice-sms-templates-table" loading={isLoading} fallback={<TableSkeleton columns={7} rows={6} />}>
              <TableSkeleton columns={7} rows={6} />
            </BoneyardSkeleton>
          ) : templates.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">No SMS templates found yet.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                      <th className="px-6 py-4 font-semibold">Template</th>
                      <th className="px-6 py-4 font-semibold">Variables</th>
                      <th className="px-6 py-4 font-semibold">Default</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Updated</th>
                      <th className="px-6 py-4 font-semibold sm:px-8"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template, index) => (
                      <tr key={template.id} className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
                        <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{(page - 1) * perPage + index + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex min-w-[320px] items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><FileText className="h-4 w-4" /></div>
                            <div>
                              <p className="font-medium text-[#2d3150]">{template.name}</p>
                              <p className="mt-1 line-clamp-2 max-w-xl text-xs leading-5 text-[var(--muted)]">{template.body}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[var(--muted)]">{template.variables_json?.length ? template.variables_json.join(", ") : "-"}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">{template.is_default ? "Yes" : "No"}</td>
                        <td className="px-6 py-4"><StatusBadge status={template.status} /></td>
                        <td className="px-6 py-4 text-[var(--muted)]">{formatDate(template.updated_at)}</td>
                        <td className="px-6 py-4 sm:px-8">
                          <div className="flex justify-end gap-2">
                            <Button as="span" variant="outline" size="icon-sm" aria-label="Edit SMS template" title="Edit" disabled={deletingTemplateId === template.id} onClick={() => openEditForm(template)}>
                              <PencilLine className="h-3.5 w-3.5" />
                            </Button>
                            <Button as="span" variant="danger-soft" size="icon-sm" aria-label="Delete SMS template" title="Delete" disabled={deletingTemplateId === template.id} onClick={() => void handleDelete(template)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginationMeta ? <Pagination meta={paginationMeta} perPageOptions={PER_PAGE_OPTIONS} onPageChange={(nextPage) => updateListUrl({ page: nextPage })} onPerPageChange={(nextPerPage) => updateListUrl({ page: DEFAULT_PAGE, perPage: nextPerPage })} /> : null}
            </>
          )}
        </section>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: AdminSmsStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
      {status}
    </span>
  );
}

function InvoiceSmsTemplatesPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Invoice SMS Templates</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Create reusable SMS copy for invoice notifications.</p>
      </section>
    </main>
  );
}

export default function InvoiceSmsTemplatesPage() {
  return (
    <Suspense fallback={<InvoiceSmsTemplatesPageFallback />}>
      <InvoiceSmsTemplatesPageContent />
    </Suspense>
  );
}
