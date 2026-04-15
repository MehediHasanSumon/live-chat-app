"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InvoiceSummaryItem = {
  productName: string;
  unitName: string | null;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type InvoiceSummaryData = {
  invoiceNo: string;
  invoiceDatetime: string | null;
  customerName: string;
  customerMobile: string | null;
  vehicleNo: string | null;
  paymentType: string;
  paymentStatus?: string;
  status?: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  items: InvoiceSummaryItem[];
};

type InvoiceSummaryProps = {
  invoice: InvoiceSummaryData;
  className?: string;
  showPrintButton?: boolean;
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatInvoiceMoney(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

export function formatInvoiceDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function printInvoiceSummary(invoice: InvoiceSummaryData) {
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    return;
  }

  const rows = invoice.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.unitName ?? "-")}</td>
          <td class="right">${formatInvoiceMoney(item.price)}</td>
          <td class="right">${formatInvoiceMoney(item.quantity)}</td>
          <td class="right">${formatInvoiceMoney(item.lineTotal)}</td>
        </tr>
      `,
    )
    .join("");

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(invoice.invoiceNo)} - Cash Memo</title>
        <style>
          * { box-sizing: border-box; }
          body { color: #1f2440; font-family: Arial, sans-serif; margin: 0; padding: 32px; }
          .memo { border: 1px solid #d9deef; margin: 0 auto; max-width: 760px; padding: 28px; }
          h1, h2, p { margin: 0; }
          h1 { font-size: 14px; letter-spacing: 0.18em; text-align: center; text-transform: uppercase; }
          h2 { font-size: 30px; margin-top: 10px; text-align: center; }
          .grid { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; margin-top: 24px; }
          .field { border: 1px solid #e3e7f3; border-radius: 8px; padding: 10px 12px; }
          .label { color: #7983a0; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
          .value { font-size: 15px; font-weight: 700; margin-top: 5px; }
          table { border-collapse: collapse; margin-top: 22px; width: 100%; }
          th, td { border-bottom: 1px solid #e3e7f3; font-size: 13px; padding: 11px 8px; text-align: left; }
          th { color: #7983a0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
          .right { text-align: right; }
          .totals { margin-left: auto; margin-top: 18px; width: 280px; }
          .totals p { display: flex; font-size: 14px; justify-content: space-between; padding: 6px 0; }
          .totals .grand { border-top: 1px solid #d9deef; font-size: 18px; font-weight: 800; margin-top: 6px; padding-top: 10px; }
          @media print { body { padding: 0; } .memo { border: 0; max-width: none; } }
        </style>
      </head>
      <body>
        <section class="memo">
          <h1>Make Invoice</h1>
          <h2>Cash Memo</h2>
          <div class="grid">
            <div class="field"><p class="label">Invoice No</p><p class="value">${escapeHtml(invoice.invoiceNo)}</p></div>
            <div class="field"><p class="label">Date and Time</p><p class="value">${escapeHtml(formatInvoiceDateTime(invoice.invoiceDatetime))}</p></div>
            <div class="field"><p class="label">Vehicle No</p><p class="value">${escapeHtml(invoice.vehicleNo ?? "-")}</p></div>
            <div class="field"><p class="label">Payment</p><p class="value">${escapeHtml(invoice.paymentType.toUpperCase())}</p></div>
            <div class="field"><p class="label">Customer Name</p><p class="value">${escapeHtml(invoice.customerName)}</p></div>
            <div class="field"><p class="label">Customer Mobile Number</p><p class="value">${escapeHtml(invoice.customerMobile ?? "-")}</p></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Unit</th>
                <th class="right">Price</th>
                <th class="right">Quantity</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="totals">
            <p><span>Subtotal</span><span>BDT ${formatInvoiceMoney(invoice.subtotalAmount)}</span></p>
            <p><span>Discount</span><span>BDT ${formatInvoiceMoney(invoice.discountAmount)}</span></p>
            <p class="grand"><span>Total</span><span>BDT ${formatInvoiceMoney(invoice.totalAmount)}</span></p>
            <p><span>Paid</span><span>BDT ${formatInvoiceMoney(invoice.paidAmount)}</span></p>
            <p><span>Due</span><span>BDT ${formatInvoiceMoney(invoice.dueAmount)}</span></p>
          </div>
        </section>
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

export function InvoiceSummary({ invoice, className, showPrintButton = false }: InvoiceSummaryProps) {
  return (
    <section className={cn("glass-card overflow-hidden rounded-[1.5rem]", className)}>
      <div className="flex flex-col gap-4 border-b border-[var(--line)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Make Invoice</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#1f2440]">Cash Memo</h2>
        </div>
        {showPrintButton ? (
          <Button className="gap-2 self-start rounded-full px-5 sm:self-center" onClick={() => printInvoiceSummary(invoice)}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        ) : null}
      </div>

      <div className="px-6 py-6 sm:px-8">
        <div className="grid gap-3 md:grid-cols-2">
          <SummaryField label="Invoice No" value={invoice.invoiceNo} />
          <SummaryField label="Date and Time" value={formatInvoiceDateTime(invoice.invoiceDatetime)} />
          <SummaryField label="Vehicle No" value={invoice.vehicleNo ?? "-"} />
          <SummaryField label="Payment" value={invoice.paymentType.toUpperCase()} />
          <SummaryField label="Customer Name" value={invoice.customerName} />
          <SummaryField label="Customer Mobile Number" value={invoice.customerMobile ?? "-"} />
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Unit</th>
                <th className="px-4 py-3 text-right font-semibold">Price</th>
                <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-sm text-[var(--muted)]" colSpan={6}>
                    No products added yet.
                  </td>
                </tr>
              ) : (
                invoice.items.map((item, index) => (
                  <tr key={`${item.productName}-${index}`} className="border-b border-[var(--line)] text-sm last:border-0">
                    <td className="px-4 py-3 text-[var(--muted)]">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-[#2d3150]">{item.productName}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{item.unitName ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-[var(--muted)]">BDT {formatInvoiceMoney(item.price)}</td>
                    <td className="px-4 py-3 text-right text-[var(--muted)]">{formatInvoiceMoney(item.quantity)}</td>
                    <td className="px-4 py-3 text-right font-medium text-[#2d3150]">BDT {formatInvoiceMoney(item.lineTotal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-sm space-y-2 text-sm">
            <SummaryAmount label="Subtotal" value={invoice.subtotalAmount} />
            <SummaryAmount label="Discount" value={invoice.discountAmount} />
            <SummaryAmount label="Total Amount" value={invoice.totalAmount} strong />
            <SummaryAmount label="Paid" value={invoice.paidAmount} />
            <SummaryAmount label="Due" value={invoice.dueAmount} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#2d3150]">{value || "-"}</p>
    </div>
  );
}

function SummaryAmount({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <p className={cn("flex items-center justify-between", strong && "border-t border-[var(--line)] pt-3 text-lg font-semibold text-[#1f2440]")}>
      <span>{label}</span>
      <span>BDT {formatInvoiceMoney(value)}</span>
    </p>
  );
}
