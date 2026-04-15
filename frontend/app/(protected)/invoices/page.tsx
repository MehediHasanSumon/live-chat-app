"use client";

import Link from "next/link";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { Eye, PencilLine, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { BoneyardSkeleton, TableSkeleton } from "@/components/ui/boneyard-loading";
import { Pagination } from "@/components/ui/pagination";
import { TextInput } from "@/components/ui/text-input";
import { AdminInvoiceRecord, useAdminInvoicesQuery, useDeleteAdminInvoiceMutation } from "@/lib/hooks/use-admin-invoices";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];

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

function InvoicesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = parseSearchParam(searchParams.get("search"));
  const { data: invoicesResponse, isLoading, error } = useAdminInvoicesQuery({ page, perPage, search }, true);
  const deleteInvoice = useDeleteAdminInvoiceMutation();
  const invoices = invoicesResponse?.data ?? [];
  const paginationMeta = invoicesResponse?.meta;
  const [searchDraft, setSearchDraft] = useState(search);
  const isTableBusy = isLoading || deleteInvoice.isPending;

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
    if (!paginationMeta || page <= paginationMeta.last_page) {
      return;
    }

    updatePaginationUrl(paginationMeta.last_page, perPage);
  }, [page, paginationMeta, perPage, updatePaginationUrl]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSearchUrl(searchDraft);
  }

  function handleClearSearch() {
    setSearchDraft("");
    updateSearchUrl("");
  }

  async function handleDelete(invoice: AdminInvoiceRecord) {
    if (!window.confirm(`Delete invoice "${invoice.invoice_no}"?`)) {
      return;
    }

    await deleteInvoice.mutateAsync(invoice.id);
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Invoices</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Create cash memos and review submitted invoices.</p>
          </div>

          <Link href="/invoices/create">
            <Button className="gap-2 rounded-full px-5">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          </Link>
        </div>
      </section>

      <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-5 sm:px-8">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => handleSearchSubmit(event)}>
          <div className="flex-1">
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Search</label>
            <TextInput
              placeholder="Search invoices, customers, mobile, vehicle"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full px-5">
              Search
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
              disabled={!search && !searchDraft}
              onClick={handleClearSearch}
            >
              Clear
            </Button>
          </div>
        </form>
      </section>

      {!error ? (
        <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
          {isLoading ? (
            <BoneyardSkeleton name="invoices-table" loading={isLoading} fallback={<TableSkeleton columns={8} rows={6} />}>
              <TableSkeleton columns={8} rows={6} />
            </BoneyardSkeleton>
          ) : invoices.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">
              {search ? "No invoices matched your search." : "No invoices found yet."}
            </div>
          ) : (
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
                        <p className="mt-1 text-xs capitalize text-[var(--muted)]">{invoice.payment_status}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[#2d3150]">BDT {formatMoney(invoice.total_amount)}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Due BDT {formatMoney(invoice.due_amount)}</p>
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
                      <td className="px-6 py-4 text-[var(--muted)]">{formatDateTime(invoice.invoice_datetime)}</td>
                      <td className="px-6 py-4 sm:px-8">
                        <div className="flex justify-end gap-2">
                          <Link href={`/invoices/${invoice.id}`}>
                            <Button
                              as="span"
                              variant="outline"
                              size="xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Details
                            </Button>
                          </Link>
                          <Link href={`/invoices/${invoice.id}/edit`}>
                            <Button as="span" variant="outline" size="xs">
                              <PencilLine className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </Link>
                          <Button
                            as="span"
                            variant="danger-soft"
                            size="xs"
                            disabled={isTableBusy}
                            onClick={() => void handleDelete(invoice)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {paginationMeta ? (
                <Pagination
                  meta={paginationMeta}
                  perPageOptions={PER_PAGE_OPTIONS}
                  onPageChange={(nextPage) => updatePaginationUrl(nextPage)}
                  onPerPageChange={(nextPerPage) => updatePaginationUrl(DEFAULT_PAGE, nextPerPage)}
                />
              ) : null}
            </div>
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
