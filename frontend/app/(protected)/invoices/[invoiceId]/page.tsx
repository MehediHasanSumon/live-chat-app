"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useParams } from "next/navigation";

import { InvoiceSummary, InvoiceSummaryData, printInvoiceSummary } from "@/components/admin/invoice-summary";
import { Button } from "@/components/ui/button";
import { AdminInvoiceRecord, useAdminInvoiceQuery } from "@/lib/hooks/use-admin-invoices";

function toNumber(value: string | number | null | undefined) {
  const numericValue = Number(value ?? 0);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function toInvoiceSummary(invoice: AdminInvoiceRecord): InvoiceSummaryData {
  return {
    invoiceNo: invoice.invoice_no,
    invoiceDatetime: invoice.invoice_datetime,
    customerName: invoice.customer?.name ?? "-",
    customerMobile: invoice.customer?.mobile ?? null,
    vehicleNo: invoice.customer?.vehicle_no ?? null,
    paymentType: invoice.payment_type,
    paymentStatus: invoice.payment_status,
    status: invoice.status,
    subtotalAmount: toNumber(invoice.subtotal_amount),
    discountAmount: toNumber(invoice.discount_amount),
    totalAmount: toNumber(invoice.total_amount),
    paidAmount: toNumber(invoice.paid_amount),
    dueAmount: toNumber(invoice.due_amount),
    items: invoice.items.map((item) => ({
      productName: item.product_name,
      unitName: item.unit_name,
      price: toNumber(item.price),
      quantity: toNumber(item.quantity),
      lineTotal: toNumber(item.line_total),
    })),
  };
}

export default function InvoiceDetailsPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params.invoiceId;
  const { data: invoice, isLoading, error } = useAdminInvoiceQuery(invoiceId, Boolean(invoiceId));
  const invoiceSummary = invoice ? toInvoiceSummary(invoice) : null;

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Invoice Details</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Preview and print the selected cash memo.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/invoices">
              <Button variant="ghost" className="gap-2 rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <Button className="gap-2 rounded-full px-5" disabled={!invoiceSummary} onClick={() => invoiceSummary && printInvoiceSummary(invoiceSummary)}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-8 text-sm text-[var(--muted)] sm:px-8">
          Loading invoice...
        </section>
      ) : null}

      {error ? (
        <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-8 text-sm text-rose-600 sm:px-8">
          Could not load this invoice right now.
        </section>
      ) : null}

      {invoiceSummary ? <InvoiceSummary invoice={invoiceSummary} className="mx-auto mt-5 w-full max-w-[1328px]" /> : null}
    </main>
  );
}
