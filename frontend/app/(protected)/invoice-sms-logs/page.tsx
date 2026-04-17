"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { BoneyardSkeleton, TableSkeleton } from "@/components/ui/boneyard-loading";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { PdfDownloadButton } from "@/components/ui/pdf-download-button";
import { SelectInput, SelectInputOption } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { buildAdminListPdfPath } from "@/lib/admin-pdf";
import {
  AdminInvoiceSmsLogStatus,
  InvoiceSmsLogRecord,
  useAdminInvoiceSmsLogsQuery,
} from "@/lib/hooks/use-admin-sms";
import { usePdfDownload } from "@/lib/hooks/use-pdf-download";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];
const STATUS_OPTIONS: SelectInputOption[] = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

function parsePageParam(value: string | null) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE;
}

function parsePerPageParam(value: string | null) {
  const perPage = Number(value);

  return PER_PAGE_OPTIONS.includes(perPage) ? perPage : DEFAULT_PER_PAGE;
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

function formatResponse(value: unknown) {
  if (value == null) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Provider response unavailable";
  }
}

function InvoiceSmsLogsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = (searchParams.get("search") ?? "").trim();
  const status = (searchParams.get("status") ?? "").trim();
  const { data: logsResponse, isLoading, error } = useAdminInvoiceSmsLogsQuery({ page, perPage, search, status }, true);
  const logs = logsResponse?.data ?? [];
  const paginationMeta = logsResponse?.meta;
  const [searchDraft, setSearchDraft] = useState(search);
  const [statusDraft, setStatusDraft] = useState(status);
  const { download, downloadError, isDownloadingPdf } = usePdfDownload();

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

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateListUrl({ page: DEFAULT_PAGE, search: searchDraft, status: statusDraft });
  }

  async function handleDownloadPdf() {
    await download(buildAdminListPdfPath("invoice-sms-logs", { search, status }), "invoice-sms-logs");
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Invoice SMS Logs</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Review invoice SMS delivery attempts and provider responses.</p>
          </div>
          <PdfDownloadButton isLoading={isDownloadingPdf} onClick={() => void handleDownloadPdf()} />
        </div>
      </section>

      {downloadError ? <p className="mx-auto mt-3 w-full max-w-[1328px] text-sm text-rose-600">{downloadError}</p> : null}

      <section className="glass-card relative z-30 mx-auto mt-5 w-full max-w-[1328px] overflow-visible rounded-[1.5rem] px-6 py-5 sm:px-8">
        <form className="flex flex-col gap-3 lg:flex-row lg:items-end" onSubmit={handleSearchSubmit}>
          <div className="flex-1">
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Search</label>
            <TextInput placeholder="Search invoice, mobile, recipient, sender, message" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
          </div>
          <div className="w-full lg:w-56">
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Status</label>
            <SelectInput value={statusDraft} options={STATUS_OPTIONS} dropdownLabel="Status" onChange={setStatusDraft} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full px-5">Search</Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
              disabled={!search && !searchDraft && !status && !statusDraft}
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
        <section className="glass-card relative z-0 mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-5 text-sm text-rose-600 sm:px-8">Unable to load SMS logs right now.</section>
      ) : (
        <section className="glass-card relative z-0 mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
          {isLoading ? (
            <BoneyardSkeleton name="invoice-sms-logs-table" loading={isLoading} fallback={<TableSkeleton columns={8} rows={6} />}>
              <TableSkeleton columns={8} rows={6} />
            </BoneyardSkeleton>
          ) : logs.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">No SMS logs found yet.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                      <th className="px-6 py-4 font-semibold">Invoice</th>
                      <th className="px-6 py-4 font-semibold">Recipient</th>
                      <th className="px-6 py-4 font-semibold">Template</th>
                      <th className="px-6 py-4 font-semibold">Message</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Sent</th>
                      <th className="px-6 py-4 font-semibold sm:px-8">Provider Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => (
                      <SmsLogRow key={log.id} log={log} index={(page - 1) * perPage + index + 1} />
                    ))}
                  </tbody>
                </table>
              </div>
              {paginationMeta ? (
                <Pagination
                  meta={paginationMeta}
                  disabled={false}
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

function SmsLogRow({ index, log }: { index: number; log: InvoiceSmsLogRecord }) {
  return (
    <tr className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{index}</td>
      <td className="px-6 py-4">
        <div className="min-w-[150px]">
          <p className="font-medium text-[#2d3150]">{log.invoice?.invoice_no ?? `#${log.invoice_id}`}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Total {log.invoice?.total_amount ?? "-"}</p>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="min-w-[180px]">
          <p className="font-medium text-[#2d3150]">{log.recipient_name ?? log.customer?.name ?? "-"}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{log.mobile}</p>
          {log.sender_id ? <p className="mt-1 text-xs text-[var(--muted)]">From {log.sender_id}</p> : null}
        </div>
      </td>
      <td className="px-6 py-4 text-[var(--muted)]">{log.template?.name ?? "-"}</td>
      <td className="px-6 py-4">
        <div className="flex min-w-[320px] items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <p className="line-clamp-3 max-w-md text-sm leading-5 text-[#2d3150]">{log.message ?? "-"}</p>
        </div>
      </td>
      <td className="px-6 py-4"><StatusBadge status={log.status} /></td>
      <td className="px-6 py-4 text-[var(--muted)]">{formatDateTime(log.sent_at ?? log.created_at)}</td>
      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">
        <p className="line-clamp-3 min-w-[260px] max-w-sm break-all text-xs leading-5">{formatResponse(log.provider_response)}</p>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: AdminInvoiceSmsLogStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        status === "sent" && "bg-emerald-50 text-emerald-700",
        status === "pending" && "bg-amber-50 text-amber-700",
        status === "failed" && "bg-rose-50 text-rose-700",
      )}
    >
      {status}
    </span>
  );
}

function InvoiceSmsLogsPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Invoice SMS Logs</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Review invoice SMS delivery attempts and provider responses.</p>
      </section>
    </main>
  );
}

export default function InvoiceSmsLogsPage() {
  return (
    <Suspense fallback={<InvoiceSmsLogsPageFallback />}>
      <InvoiceSmsLogsPageContent />
    </Suspense>
  );
}
