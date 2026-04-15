"use client";

import Link from "next/link";
import { FormEvent, Suspense, useCallback, useState } from "react";
import { CalendarDays, FileText, Plus, ReceiptText, Wallet } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectInput, SelectInputOption } from "@/components/ui/select-input";
import { InvoicePaymentType, InvoiceStatementFilters, useAdminMonthlyInvoiceStatementQuery } from "@/lib/hooks/use-admin-invoices";
import { useAdminUsersQuery } from "@/lib/hooks/use-admin-users";

const paymentMethodOptions: SelectInputOption[] = [
  { value: "", label: "All methods" },
  { value: "cash", label: "Cash" },
  { value: "pos", label: "POS" },
  { value: "due", label: "Due" },
];

function getCurrentMonthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    dateFrom: formatDateValue(firstDay),
    dateTo: formatDateValue(lastDay),
  };
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateParam(value: string | null, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? fallback : value;
}

function parsePaymentTypeParam(value: string | null): InvoicePaymentType | "" {
  return value === "cash" || value === "pos" || value === "due" ? value : "";
}

function parseCreatedByParam(value: string | null) {
  if (!value) {
    return "";
  }

  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue > 0 ? String(numericValue) : "";
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDisplayRange(dateFrom: string, dateTo: string) {
  if (dateFrom === dateTo) {
    return formatDisplayDate(dateFrom);
  }

  return `${formatDisplayDate(dateFrom)} to ${formatDisplayDate(dateTo)}`;
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

function formatQuantity(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(numericValue);
}

function MonthlyStatementsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultRange = getCurrentMonthRange();
  const dateFrom = parseDateParam(searchParams.get("date_from"), defaultRange.dateFrom);
  const dateTo = parseDateParam(searchParams.get("date_to"), defaultRange.dateTo);
  const filters: InvoiceStatementFilters = {
    dateFrom,
    dateTo,
    paymentType: parsePaymentTypeParam(searchParams.get("payment_type")),
    createdBy: parseCreatedByParam(searchParams.get("created_by")),
  };
  const [filterDraft, setFilterDraft] = useState<InvoiceStatementFilters>(filters);
  const { data: usersResponse } = useAdminUsersQuery({ page: 1, perPage: 50, search: "" }, true);
  const { data: statement, isLoading, error } = useAdminMonthlyInvoiceStatementQuery(filters, true);
  const summary = statement?.summary;
  const dailySummaries = statement?.daily_summaries ?? [];
  const productSummaries = statement?.product_summaries ?? [];
  const saleByUsers = usersResponse?.data ?? [];
  const saleByOptions: SelectInputOption[] = [
    { value: "", label: "All users" },
    ...saleByUsers.map((user) => ({ value: String(user.id), label: user.name })),
  ];

  const updateFilterUrl = useCallback(
    (nextFilters: InvoiceStatementFilters) => {
      const params = new URLSearchParams(searchParams.toString());

      params.delete("month");

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

      if (nextFilters.paymentType) {
        params.set("payment_type", nextFilters.paymentType);
      } else {
        params.delete("payment_type");
      }

      if (nextFilters.createdBy) {
        params.set("created_by", nextFilters.createdBy);
      } else {
        params.delete("created_by");
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedDateFrom = parseDateParam(filterDraft.dateFrom, defaultRange.dateFrom);
    const normalizedDateTo = parseDateParam(filterDraft.dateTo, normalizedDateFrom);
    const nextFilters = {
      ...filterDraft,
      dateFrom: normalizedDateFrom,
      dateTo: normalizedDateTo < normalizedDateFrom ? normalizedDateFrom : normalizedDateTo,
    };

    setFilterDraft(nextFilters);
    updateFilterUrl(nextFilters);
  }

  function handleReset() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("month");
    params.delete("date_from");
    params.delete("date_to");
    params.delete("payment_type");
    params.delete("created_by");
    const queryString = params.toString();
    setFilterDraft({
      dateFrom: defaultRange.dateFrom,
      dateTo: defaultRange.dateTo,
      paymentType: "",
      createdBy: "",
    });
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Monthly Statements</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Submitted invoice totals for {formatDisplayRange(dateFrom, dateTo)}.</p>
          </div>

          <Link href="/invoices/create">
            <Button className="gap-2 rounded-full px-5">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          </Link>
        </div>
      </section>

      <section className="glass-card relative z-30 mx-auto mt-5 w-full max-w-[1328px] overflow-visible rounded-[1.5rem] px-6 py-5 sm:px-8">
        <form className="grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Start Date</label>
            <DatePicker
              value={filterDraft.dateFrom}
              onChange={(value) => setFilterDraft((current) => ({ ...current, dateFrom: value }))}
              defaultToToday={false}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">End Date</label>
            <DatePicker
              value={filterDraft.dateTo}
              onChange={(value) => setFilterDraft((current) => ({ ...current, dateTo: value }))}
              defaultToToday={false}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Payment Method</label>
            <SelectInput
              value={filterDraft.paymentType}
              options={paymentMethodOptions}
              dropdownLabel="Payment Methods"
              onChange={(nextValue) => setFilterDraft((current) => ({ ...current, paymentType: parsePaymentTypeParam(nextValue) }))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Sale By</label>
            <SelectInput
              value={filterDraft.createdBy}
              options={saleByOptions}
              dropdownLabel="Sale By"
              onChange={(nextValue) => setFilterDraft((current) => ({ ...current, createdBy: parseCreatedByParam(nextValue) }))}
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
              onClick={handleReset}
            >
              Reset
            </Button>
          </div>
        </form>
      </section>

      {error ? (
        <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-8 text-sm text-rose-600 sm:px-8">
          Unable to load the monthly statement right now.
        </section>
      ) : null}

      {!error ? (
        <>
          <section className="relative z-10 mx-auto mt-5 grid w-full max-w-[1328px] gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="glass-card rounded-[1.25rem] px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#ea580c]">
                  <ReceiptText className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Invoices</p>
                  <p className="mt-1 text-2xl font-semibold text-[#1f2440]">{isLoading ? "-" : (summary?.invoice_count ?? 0)}</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-[1.25rem] px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Wallet className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Total Sales</p>
                  <p className="mt-1 text-2xl font-semibold text-[#1f2440]">BDT {isLoading ? "-" : formatMoney(summary?.total_amount ?? "0")}</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-[1.25rem] px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Paid</p>
                  <p className="mt-1 text-2xl font-semibold text-[#1f2440]">BDT {isLoading ? "-" : formatMoney(summary?.paid_amount ?? "0")}</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-[1.25rem] px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Due</p>
                  <p className="mt-1 text-2xl font-semibold text-[#1f2440]">BDT {isLoading ? "-" : formatMoney(summary?.due_amount ?? "0")}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
            <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
              <h2 className="text-xl font-semibold text-[#1f2440]">Daily Totals</h2>
            </div>
            {isLoading ? (
              <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">Loading daily totals...</div>
            ) : dailySummaries.length === 0 ? (
              <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">No submitted invoices found for this month.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <th className="px-6 py-4 font-semibold sm:px-8">Date</th>
                      <th className="px-6 py-4 font-semibold">Invoices</th>
                      <th className="px-6 py-4 font-semibold">Cash</th>
                      <th className="px-6 py-4 font-semibold">POS</th>
                      <th className="px-6 py-4 font-semibold">Due Sales</th>
                      <th className="px-6 py-4 font-semibold">Paid</th>
                      <th className="px-6 py-4 font-semibold sm:px-8">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummaries.map((day) => (
                      <tr key={day.statement_date} className="border-b border-[var(--line)] text-sm last:border-0">
                        <td className="px-6 py-4 font-medium text-[#2d3150] sm:px-8">{formatDisplayDate(day.statement_date)}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">{day.invoice_count}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">BDT {formatMoney(day.cash_amount)}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">BDT {formatMoney(day.pos_amount)}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">BDT {formatMoney(day.due_sales_amount)}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">BDT {formatMoney(day.paid_amount)}</td>
                        <td className="px-6 py-4 font-medium text-[#2d3150] sm:px-8">BDT {formatMoney(day.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
            <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
              <h2 className="text-xl font-semibold text-[#1f2440]">Product Summary</h2>
            </div>
            {isLoading ? (
              <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">Loading products...</div>
            ) : productSummaries.length === 0 ? (
              <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">No submitted invoice items found for this month.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <th className="px-6 py-4 font-semibold sm:px-8">Product</th>
                      <th className="px-6 py-4 font-semibold">Unit</th>
                      <th className="px-6 py-4 font-semibold">Qty</th>
                      <th className="px-6 py-4 font-semibold">Avg Price</th>
                      <th className="px-6 py-4 font-semibold sm:px-8">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSummaries.map((product) => (
                      <tr key={`${product.product_name}-${product.unit_code ?? "unit"}`} className="border-b border-[var(--line)] text-sm last:border-0">
                        <td className="px-6 py-4 font-medium text-[#2d3150] sm:px-8">{product.product_name}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">{product.unit_name ?? product.unit_code ?? "-"}</td>
                        <td className="px-6 py-4 text-[#2d3150]">{formatQuantity(product.quantity)}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">BDT {formatMoney(product.average_price)}</td>
                        <td className="px-6 py-4 font-medium text-[#2d3150] sm:px-8">BDT {formatMoney(product.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function MonthlyStatementsPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Monthly Statements</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Loading statement details.</p>
        </div>
      </section>
    </main>
  );
}

export default function MonthlyStatementsPage() {
  return (
    <Suspense fallback={<MonthlyStatementsPageFallback />}>
      <MonthlyStatementsPageContent />
    </Suspense>
  );
}
