"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { PencilLine, Plus, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { BoneyardSkeleton, TableSkeleton } from "@/components/ui/boneyard-loading";
import { Pagination } from "@/components/ui/pagination";
import { SelectInput, SelectInputOption } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import {
  AdminSmsCredentialRecord,
  AdminSmsStatus,
  useAdminSmsCredentialsQuery,
  useCreateAdminSmsCredentialMutation,
  useDeleteAdminSmsCredentialMutation,
  useUpdateAdminSmsCredentialMutation,
} from "@/lib/hooks/use-admin-sms";
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

type CredentialFormState = {
  url: string;
  api_key: string;
  sender_id: string;
  status: AdminSmsStatus;
};

function createEmptyForm(): CredentialFormState {
  return {
    url: "",
    api_key: "",
    sender_id: "",
    status: "inactive",
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

function SmsCredentialsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = (searchParams.get("search") ?? "").trim();
  const status = (searchParams.get("status") ?? "").trim();
  const { data: credentialsResponse, isLoading, error } = useAdminSmsCredentialsQuery({ page, perPage, search, status }, true);
  const credentials = credentialsResponse?.data ?? [];
  const paginationMeta = credentialsResponse?.meta;
  const createCredential = useCreateAdminSmsCredentialMutation();
  const updateCredential = useUpdateAdminSmsCredentialMutation();
  const deleteCredential = useDeleteAdminSmsCredentialMutation();
  const [searchDraft, setSearchDraft] = useState(search);
  const [statusDraft, setStatusDraft] = useState(status);
  const [form, setForm] = useState<CredentialFormState>(() => createEmptyForm());
  const [editingCredential, setEditingCredential] = useState<AdminSmsCredentialRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const isSubmitting = createCredential.isPending || updateCredential.isPending;
  const isTableBusy = deleteCredential.isPending;

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

  function updateFormValue<K extends keyof CredentialFormState>(key: K, value: CredentialFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingCredential(null);
    setForm(createEmptyForm());
    setFormError(null);
  }

  function openCreateForm() {
    setIsFormOpen(true);
    setEditingCredential(null);
    setForm(createEmptyForm());
    setFormError(null);
  }

  function openEditForm(credential: AdminSmsCredentialRecord) {
    setIsFormOpen(true);
    setEditingCredential(credential);
    setForm({
      url: credential.url,
      api_key: "",
      sender_id: credential.sender_id,
      status: credential.status,
    });
    setFormError(null);
  }

  function validateForm() {
    const url = form.url.trim();
    const apiKey = form.api_key.trim();
    const senderId = form.sender_id.trim();

    if (!url) return "Provider URL is required.";
    try {
      new URL(url);
    } catch {
      return "Provider URL must be a valid URL.";
    }
    if (!editingCredential && !apiKey) return "API key is required.";
    if (apiKey.length > 4000) return "API key must be 4000 characters or fewer.";
    if (!senderId) return "Sender ID is required.";
    if (senderId.length > 120) return "Sender ID must be 120 characters or fewer.";
    if (!["active", "inactive"].includes(form.status)) return "Status is invalid.";

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
      url: form.url.trim(),
      ...(form.api_key.trim() ? { api_key: form.api_key.trim() } : {}),
      sender_id: form.sender_id.trim(),
      status: form.status,
    };

    try {
      if (editingCredential) {
        await updateCredential.mutateAsync({ credentialId: editingCredential.id, payload });
      } else {
        await createCredential.mutateAsync(payload);
      }

      closeForm();
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.url?.[0] ??
            submissionError.errors?.api_key?.[0] ??
            submissionError.errors?.sender_id?.[0] ??
            submissionError.errors?.status?.[0] ??
            submissionError.message,
        );
        return;
      }

      setFormError("Unable to save SMS credential right now.");
    }
  }

  async function handleDelete(credential: AdminSmsCredentialRecord) {
    if (!window.confirm(`Delete SMS credential "${credential.sender_id}"?`)) {
      return;
    }

    setFormError(null);

    try {
      await deleteCredential.mutateAsync(credential.id);
      if (editingCredential?.id === credential.id) closeForm();
    } catch (submissionError) {
      setFormError(submissionError instanceof ApiClientError ? submissionError.message : "Unable to delete SMS credential right now.");
    }
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">SMS Credentials</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Manage provider access for invoice SMS delivery.</p>
          </div>
          <Button
            className="gap-2 self-start rounded-full px-5 sm:self-center"
            aria-controls="sms-credential-form-section"
            aria-expanded={isFormOpen}
            onClick={() => (isFormOpen ? closeForm() : openCreateForm())}
          >
            {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isFormOpen ? "Close" : "Create Credential"}
          </Button>
        </div>
      </section>

      <div className={cn("mx-auto w-full max-w-[1328px] overflow-hidden transition-all duration-300 ease-out", isFormOpen ? "mt-5 max-h-[720px] translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-2 opacity-0")}>
        <section id="sms-credential-form-section" aria-hidden={!isFormOpen} className="glass-card overflow-hidden rounded-[1.5rem]">
          <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
            <h2 className="text-xl font-semibold text-[#1f2440]">{editingCredential ? "Edit Credential" : "Create Credential"}</h2>
          </div>
          <form onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-5 px-6 py-6 sm:px-8 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Provider URL</label>
                <TextInput placeholder="https://sms.example.com/send" value={form.url} onChange={(event) => updateFormValue("url", event.target.value)} disabled={!isFormOpen || isSubmitting} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">API Key</label>
                <TextInput
                  type="password"
                  placeholder={editingCredential ? "Leave blank to keep current key" : "Provider API key"}
                  value={form.api_key}
                  onChange={(event) => updateFormValue("api_key", event.target.value)}
                  disabled={!isFormOpen || isSubmitting}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Sender ID</label>
                <TextInput placeholder="SHOP" value={form.sender_id} onChange={(event) => updateFormValue("sender_id", event.target.value)} disabled={!isFormOpen || isSubmitting} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Status</label>
                <SelectInput value={form.status} options={FORM_STATUS_OPTIONS} dropdownLabel="Status" onChange={(value) => updateFormValue("status", value as AdminSmsStatus)} disabled={!isFormOpen || isSubmitting} />
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
        <form
          className="flex flex-col gap-3 lg:flex-row lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            updateListUrl({ page: DEFAULT_PAGE, search: searchDraft, status: statusDraft });
          }}
        >
          <div className="flex-1">
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Search</label>
            <TextInput placeholder="Search URL or sender ID" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
          </div>
          <div className="w-full lg:w-56">
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Status</label>
            <SelectInput value={statusDraft} options={STATUS_OPTIONS} dropdownLabel="Status" onChange={setStatusDraft} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full px-5" disabled={isTableBusy}>Search</Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
              disabled={isTableBusy || (!search && !searchDraft && !status && !statusDraft)}
              onClick={() => {
                setSearchDraft("");
                setStatusDraft("");
                updateListUrl({ page: DEFAULT_PAGE, search: "", status: "" });
              }}
            >
              Clear
            </Button>
          </div>
        </form>
      </section>

      {error ? (
        <section className="glass-card relative z-0 mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-5 text-sm text-rose-600 sm:px-8">Unable to load SMS credentials right now.</section>
      ) : (
        <section className="glass-card relative z-0 mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
          {isLoading ? (
            <BoneyardSkeleton name="sms-credentials-table" loading={isLoading} fallback={<TableSkeleton columns={7} rows={6} />}>
              <TableSkeleton columns={7} rows={6} />
            </BoneyardSkeleton>
          ) : credentials.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">No SMS credentials found yet.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                      <th className="px-6 py-4 font-semibold">Provider</th>
                      <th className="px-6 py-4 font-semibold">Sender</th>
                      <th className="px-6 py-4 font-semibold">Key</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Updated</th>
                      <th className="px-6 py-4 font-semibold sm:px-8"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map((credential, index) => (
                      <tr key={credential.id} className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
                        <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{(page - 1) * perPage + index + 1}</td>
                        <td className="px-6 py-4">
                          <p className="min-w-[260px] break-all font-medium text-[#2d3150]">{credential.url}</p>
                        </td>
                        <td className="px-6 py-4 text-[var(--muted)]">{credential.sender_id}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">{credential.api_key_preview ?? (credential.api_key_present ? "Saved" : "-")}</td>
                        <td className="px-6 py-4"><StatusBadge status={credential.status} /></td>
                        <td className="px-6 py-4 text-[var(--muted)]">{formatDate(credential.updated_at)}</td>
                        <td className="px-6 py-4 sm:px-8">
                          <div className="flex justify-end gap-2">
                            <Button as="span" variant="outline" size="xs" disabled={isTableBusy} onClick={() => openEditForm(credential)}>
                              <PencilLine className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button as="span" variant="danger-soft" size="xs" disabled={isTableBusy} onClick={() => void handleDelete(credential)}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginationMeta ? (
                <Pagination
                  meta={paginationMeta}
                  disabled={isTableBusy}
                  perPageOptions={PER_PAGE_OPTIONS}
                  onPageChange={(nextPage) => updateListUrl({ page: nextPage })}
                  onPerPageChange={(nextPerPage) => updateListUrl({ page: DEFAULT_PAGE, perPage: nextPerPage })}
                />
              ) : null}
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

function SmsCredentialsPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">SMS Credentials</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Manage provider access for invoice SMS delivery.</p>
      </section>
    </main>
  );
}

export default function SmsCredentialsPage() {
  return (
    <Suspense fallback={<SmsCredentialsPageFallback />}>
      <SmsCredentialsPageContent />
    </Suspense>
  );
}
