"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";

import { BoneyardSkeleton, PanelSkeleton } from "@/components/ui/boneyard-loading";
import { Button } from "@/components/ui/button";
import { useAdminInvoiceQuery } from "@/lib/hooks/use-admin-invoices";
import { InvoiceFormPage } from "../../create/page";

export default function EditInvoicePage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params.invoiceId;
  const { data: invoice, isLoading, error } = useAdminInvoiceQuery(invoiceId, Boolean(invoiceId));

  if (isLoading) {
    return (
      <main className="shell px-4 py-6 sm:px-6">
        <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem]">
          <BoneyardSkeleton name="invoice-edit-panel" loading={isLoading} fallback={<PanelSkeleton lines={10} />}>
            <PanelSkeleton lines={10} />
          </BoneyardSkeleton>
        </section>
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main className="shell px-4 py-6 sm:px-6">
        <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Edit Invoice</h1>
              <p className="mt-2 text-sm text-rose-600">Could not load this invoice right now.</p>
            </div>

            <Link href="/invoices">
              <Button variant="ghost" className="gap-2 rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <InvoiceFormPage invoice={invoice} />;
}
