"use client";

import Link from "next/link";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { Eye, PencilLine, Plus, Send, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PdfDownloadButton } from "@/components/ui/pdf-download-button";
import { Button } from "@/components/ui/button";
import { BoneyardSkeleton, TableSkeleton } from "@/components/ui/boneyard-loading";
import { DatePicker } from "@/components/ui/date-picker";
import { Pagination } from "@/components/ui/pagination";
import { SelectInput, SelectInputOption } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { buildAdminListPdfPath } from "@/lib/admin-pdf";
import { ApiClientError } from "@/lib/api-client";
import {
  AdminInvoiceRecord,
  InvoicePaymentStatus,
  InvoicePaymentType,
  InvoiceSmsStatus,
  InvoiceStatus,
  useAdminInvoicesQuery,
  useDeleteAdminInvoiceMutation,
  useResendAdminInvoiceSmsMutation,
} from "@/lib/hooks/use-admin-invoices";
import { usePdfDownload } from "@/lib/hooks/use-pdf-download";
import { pushToast } from "@/lib/stores/toast-store";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];
const INVOICE_STATUS_OPTIONS: SelectInputOption[] = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "cancelled", label: "Cancelled" },
];
const PAYMENT_TYPE_OPTIONS: SelectInputOption[] = [
  { value: "", label: "All Method" },
  { value: "cash", label: "Cash" },
  { value: "pos", label: "POS" },
  { value: "due", label: "Due" },
];
const PAYMENT_STATUS_OPTIONS: SelectInputOption[] = [
  { value: "", label: "All Status" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
];

type InvoiceFilterState = {
  search: string;
  status: InvoiceStatus | "";
  paymentType: InvoicePaymentType | "";
  paymentStatus: InvoicePaymentStatus | "";
  dateFrom: string;
  dateTo: string;
};

function parsePageParam(value: string | null) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE;
}

function parsePerPageParam(value: string | null) {
  const perPage = Number(value);

  return PER_PAGE_OPTIONS.includes(perPage) ? perPage : DEFAULT_PER_PAGE;
}

function parseSearchParam(value: string | null) {
  return (value ?? "").trim();
}

function parseInvoiceStatusParam(value: string | null): InvoiceStatus | "" {
  return value === "draft" || value === "submitted" || value === "cancelled" ? value : "";
}

function parsePaymentTypeParam(value: string | null): InvoicePaymentType | "" {
  return value === "cash" || value === "pos" || value === "due" ? value : "";
}

function parsePaymentStatusParam(value: string | null): InvoicePaymentStatus | "" {
  return value === "paid" || value === "partial" || value === "unpaid" ? value : "";
}

function parseDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? "" : value;
}

function hasActiveFilters(filters: InvoiceFilterState) {
  return Boolean(
    filters.search ||
      filters.status ||
      filters.paymentType ||
      filters.paymentStatus ||
      filters.dateFrom ||
      filters.dateTo,
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(numericValue);
}

function formatSmsStatus(status: InvoiceSmsStatus) {
  if (status === "not_sent") {
    return "Not Sent";
  }

  return status;
}

function smsStatusClassName(status: InvoiceSmsStatus) {
  if (status === "sent") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "pending") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "failed") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-slate-100 text-slate-600";
}

function InvoicesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const filters: InvoiceFilterState = {
    search: parseSearchParam(searchParams.get("search")),
    status: parseInvoiceStatusParam(searchParams.get("status")),
    paymentType: parsePaymentTypeParam(searchParams.get("payment_type")),
    paymentStatus: parsePaymentStatusParam(searchParams.get("payment_status")),
    dateFrom: parseDateParam(searchParams.get("date_from")),
    dateTo: parseDateParam(searchParams.get("date_to")),
  };
  const { data: invoicesResponse, isLoading, error } = useAdminInvoicesQuery(
    {
      page,
      perPage,
      search: filters.search,
      status: filters.status,
      paymentType: filters.paymentType,
      paymentStatus: filters.paymentStatus,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    },
    true,
  );
  const deleteInvoice = useDeleteAdminInvoiceMutation();
  const resendInvoiceSms = useResendAdminInvoiceSmsMutation();
  const invoices = invoicesResponse?.data ?? [];
  const paginationMeta = invoicesResponse?.meta;
  const [filterDraft, setFilterDraft] = useState<InvoiceFilterState>(filters);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<number | null>(null);
  const [resendingInvoiceId, setResendingInvoiceId] = useState<number | null>(null);
  const filtersAreActive = hasActiveFilters(filters);
  const { download, downloadError, isDownloadingPdf } = usePdfDownload();

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

  const updateFilterUrl = useCallback(
    (nextFilters: InvoiceFilterState) => {
      const params = new URLSearchParams(searchParams.toString());
      const normalizedSearch = nextFilters.search.trim();

      params.delete("page");

      if (normalizedSearch) {
        params.set("search", normalizedSearch);
      } else {
        params.delete("search");
      }

      if (nextFilters.status) {
        params.set("status", nextFilters.status);
      } else {
        params.delete("status");
      }

      if (nextFilters.paymentType) {
        params.set("payment_type", nextFilters.paymentType);
      } else {
        params.delete("payment_type");
      }

      if (nextFilters.paymentStatus) {
        params.set("payment_status", nextFilters.paymentStatus);
      } else {
        params.delete("payment_status");
      }

      if (nextFilters.dateFrom) {
        params.set("date_from", nextFilters.dateFrom);
      } else {
        params.delete("date_from");
      }

      if (nextFilters.dateTo) {
        params.set("date_to", nextFilters.dateTo);
      } else {
        params.delete("date_to");
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!paginationMeta || page <= paginationMeta.last_page) {
      return;
    }

    updatePaginationUrl(paginationMeta.last_page, perPage);
  }, [page, paginationMeta, perPage, updatePaginationUrl]);

  function updateFilterDraft<K extends keyof InvoiceFilterState>(key: K, value: InvoiceFilterState[K]) {
    setFilterDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validateFilters(nextFilters: InvoiceFilterState) {
    if (nextFilters.dateFrom && nextFilters.dateTo && nextFilters.dateTo < nextFilters.dateFrom) {
      return "End date cannot be before start date.";
    }

    return null;
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilterError(null);

    const nextFilters = {
      ...filterDraft,
      search: filterDraft.search.trim(),
    };
    const clientError = validateFilters(nextFilters);

    if (clientError) {
      setFilterError(clientError);
      return;
    }

    updateFilterUrl(nextFilters);
  }

  function handleClearFilters() {
    const emptyFilters: InvoiceFilterState = {
      search: "",
      status: "",
      paymentType: "",
      paymentStatus: "",
      dateFrom: "",
      dateTo: "",
    };

    setFilterDraft(emptyFilters);
    setFilterError(null);
    updateFilterUrl(emptyFilters);
  }

  async function handleDelete(invoice: AdminInvoiceRecord) {
    if (!window.confirm(`Delete invoice "${invoice.invoice_no}"?`)) {
      return;
    }

    setDeletingInvoiceId(invoice.id);

    try {
      await deleteInvoice.mutateAsync(invoice.id);
    } finally {
      setDeletingInvoiceId(null);
    }
  }

  async function handleResendSms(invoice: AdminInvoiceRecord) {
    setResendingInvoiceId(invoice.id);

    try {
      const response = await resendInvoiceSms.mutateAsync(invoice.id);

      if (response.sms_log?.status === "sent") {
        pushToast({
          kind: "crud",
          tone: "success",
          title: "SMS sent",
          message: `Invoice ${invoice.invoice_no} SMS sent successfully.`,
        });
        return;
      }

      pushToast({
        kind: "crud",
        tone: "error",
        title: "SMS send failed",
        message: `Invoice ${invoice.invoice_no} SMS could not be sent.`,
      });
    } catch (submissionError) {
      pushToast({
        kind: "crud",
        tone: "error",
        title: "SMS send failed",
        message: submissionError instanceof ApiClientError ? submissionError.message : "Unable to resend SMS right now.",
      });
    } finally {
      setResendingInvoiceId(null);
    }
  }

  async function handleDownloadPdf() {
    await download(buildAdminListPdfPath("invoices", {
      search: filters.search,
      status: filters.status,
      payment_type: filters.paymentType,
      payment_status: filters.paymentStatus,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
    }), "invoices");
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Invoices</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Create cash memos and review submitted invoices.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <PdfDownloadButton isLoading={isDownloadingPdf} onClick={() => void handleDownloadPdf()} />
            <Link href="/invoices/create">
              <Button className="gap-2 rounded-full px-5">
                <Plus className="h-4 w-4" />
                Create Invoice
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {downloadError ? <p className="mx-auto mt-3 w-full max-w-[1328px] text-sm text-rose-600">{downloadError}</p> : null}

      <section className="glass-card relative z-30 mx-auto mt-5 w-full max-w-[1328px] overflow-visible rounded-[1.5rem] px-6 py-5 sm:px-8">
        <form className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(150px,1fr))_auto] lg:items-end" onSubmit={handleFilterSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Search</label>
            <TextInput
              placeholder="Search invoices, customers, mobile, vehicle"
              value={filterDraft.search}
              onChange={(event) => updateFilterDraft("search", event.target.value)}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Invoice Status</label>
            <SelectInput
              value={filterDraft.status}
              options={INVOICE_STATUS_OPTIONS}
              dropdownLabel="Invoice Status"
              onChange={(value) => updateFilterDraft("status", parseInvoiceStatusParam(value))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Payment Method</label>
            <SelectInput
              value={filterDraft.paymentType}
              options={PAYMENT_TYPE_OPTIONS}
              dropdownLabel="Payment Method"
              onChange={(value) => updateFilterDraft("paymentType", parsePaymentTypeParam(value))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Payment Status</label>
            <SelectInput
              value={filterDraft.paymentStatus}
              options={PAYMENT_STATUS_OPTIONS}
              dropdownLabel="Payment Status"
              onChange={(value) => updateFilterDraft("paymentStatus", parsePaymentStatusParam(value))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Start Date</label>
            <DatePicker
              value={filterDraft.dateFrom}
              onChange={(value) => updateFilterDraft("dateFrom", parseDateParam(value))}
              defaultToToday={false}
              placeholder="Start date"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">End Date</label>
            <DatePicker
              value={filterDraft.dateTo}
              onChange={(value) => updateFilterDraft("dateTo", parseDateParam(value))}
              defaultToToday={false}
              placeholder="End date"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full px-5">
              Filter
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
              disabled={!filtersAreActive && !hasActiveFilters(filterDraft)}
              onClick={handleClearFilters}
            >
              Clear
            </Button>
          </div>

          {filterError ? <p className="text-sm text-rose-600 lg:col-span-7">{filterError}</p> : null}
        </form>
      </section>

      {!error ? (
        <section className="glass-card relative z-0 mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
          {isLoading ? (
            <BoneyardSkeleton name="invoices-table" loading={isLoading} fallback={<TableSkeleton columns={9} rows={6} />}>
              <TableSkeleton columns={9} rows={6} />
            </BoneyardSkeleton>
          ) : invoices.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">
              {filtersAreActive ? "No invoices matched your filters." : "No invoices found yet."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                    <th className="px-6 py-4 font-semibold">Invoice</th>
                    <th className="px-6 py-4 font-semibold">Customer</th>
                    <th className="px-6 py-4 font-semibold">Payment</th>
                    <th className="px-6 py-4 font-semibold">Total</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">SMS</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold sm:px-8">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice, index) => (
                    <tr key={invoice.id} className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
                      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-6 py-4 font-medium text-[#2d3150]">{invoice.invoice_no}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[#2d3150]">{invoice.customer?.name ?? "-"}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{invoice.customer?.mobile ?? invoice.customer?.vehicle_no ?? "-"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium uppercase text-[#2d3150]">{invoice.payment_type}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[#2d3150]">BDT {formatMoney(invoice.total_amount)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                            invoice.status === "submitted" && "bg-emerald-50 text-emerald-700",
                            invoice.status === "draft" && "bg-amber-50 text-amber-700",
                            invoice.status === "cancelled" && "bg-rose-50 text-rose-700",
                          )}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", smsStatusClassName(invoice.sms_status))}>
                          {formatSmsStatus(invoice.sms_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)]">{formatDateTime(invoice.invoice_datetime)}</td>
                      <td className="px-6 py-4 sm:px-8">
                        <div className="flex justify-end gap-2">
                          <Button
                            as="span"
                            variant="soft"
                            size="icon-sm"
                            aria-label="Resend SMS"
                            title={resendingInvoiceId === invoice.id ? "Sending SMS" : "Resend SMS"}
                            disabled={resendingInvoiceId === invoice.id || deletingInvoiceId === invoice.id}
                            onClick={() => void handleResendSms(invoice)}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Link href={`/invoices/${invoice.id}`}>
                            <Button
                              as="span"
                              variant="outline"
                              size="icon-sm"
                              aria-label="Invoice details"
                              title="Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Link href={`/invoices/${invoice.id}/edit`}>
                            <Button as="span" variant="outline" size="icon-sm" aria-label="Edit invoice" title="Edit">
                              <PencilLine className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button
                            as="span"
                            variant="danger-soft"
                            size="icon-sm"
                            aria-label="Delete invoice"
                            title="Delete"
                            disabled={deletingInvoiceId === invoice.id || resendingInvoiceId === invoice.id}
                            onClick={() => void handleDelete(invoice)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
                  perPageOptions={PER_PAGE_OPTIONS}
                  onPageChange={(nextPage) => updatePaginationUrl(nextPage)}
                  onPerPageChange={(nextPerPage) => updatePaginationUrl(DEFAULT_PAGE, nextPerPage)}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}

function InvoicesPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Invoices</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Create cash memos and review submitted invoices.</p>
        </div>
      </section>
    </main>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<InvoicesPageFallback />}>
      <InvoicesPageContent />
    </Suspense>
  );
}
