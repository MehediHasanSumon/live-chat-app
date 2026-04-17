"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, FileText, MapPin, Phone, ShieldCheck } from "lucide-react";

import { BoneyardSkeleton, PanelSkeleton } from "@/components/ui/boneyard-loading";
import { Button } from "@/components/ui/button";
import { PdfDownloadButton } from "@/components/ui/pdf-download-button";
import { buildAdminDetailPdfPath } from "@/lib/admin-pdf";
import { useAdminCompanySettingQuery } from "@/lib/hooks/use-admin-company-settings";
import { usePdfDownload } from "@/lib/hooks/use-pdf-download";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatVatRate(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return `${value}%`;
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(numericValue)}%`;
}

function CompanySettingDetailsContent() {
  const params = useParams<{ companySettingId: string }>();
  const companySettingId = params.companySettingId;
  const { data: companySetting, isLoading, error } = useAdminCompanySettingQuery(companySettingId, Boolean(companySettingId));
  const { download, downloadError, isDownloadingPdf } = usePdfDownload();

  async function handleDownloadPdf() {
    if (!companySettingId) {
      return;
    }

    await download(buildAdminDetailPdfPath("company-settings", companySettingId), "company-setting");
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/company-settings" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
              <ArrowLeft className="h-4 w-4" />
              Back to Company Settings
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1f2440]">Company Details</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Full company identity, compliance, VAT, and account options.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PdfDownloadButton isLoading={isDownloadingPdf} onClick={() => void handleDownloadPdf()} />
            {companySetting ? (
              <span
                className={cn(
                  "inline-flex w-fit rounded-full px-3 py-1.5 text-sm font-semibold capitalize",
                  companySetting.status === "active" && "bg-emerald-50 text-emerald-700",
                  companySetting.status === "inactive" && "bg-rose-50 text-rose-700",
                )}
              >
                {companySetting.status}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {downloadError ? <p className="mx-auto mt-3 w-full max-w-[1328px] text-sm text-rose-600">{downloadError}</p> : null}

      {error ? (
        <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-8 text-sm text-rose-600 sm:px-8">
          Unable to load company details right now.
        </section>
      ) : (
        <BoneyardSkeleton name="company-setting-details" loading={isLoading} fallback={<DetailsFallback />}>
          {companySetting ? (
            <div className="mx-auto mt-5 grid w-full max-w-[1328px] gap-5 xl:grid-cols-[1fr_360px]">
              <section className="glass-card overflow-hidden rounded-[1.5rem]">
                <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-2xl font-semibold text-[#1f2440]">{companySetting.company_name}</h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">{companySetting.proprietor_name ?? "No proprietor"}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-2">
                  <DetailGroup icon={FileText} title="Company">
                    <DetailRow label="Details" value={companySetting.company_details} />
                    <DetailRow label="Currency" value={companySetting.currency} />
                    <DetailRow label="VAT Rate" value={formatVatRate(companySetting.vat_rate)} />
                  </DetailGroup>

                  <DetailGroup icon={Phone} title="Contact">
                    <DetailRow label="Mobile" value={companySetting.company_mobile} />
                    <DetailRow label="Phone" value={companySetting.company_phone} />
                    <DetailRow label="Email" value={companySetting.company_email} />
                  </DetailGroup>

                  <DetailGroup icon={MapPin} title="Address">
                    <DetailRow label="Company Address" value={companySetting.company_address} />
                    <DetailRow label="Factory Address" value={companySetting.factory_address} />
                  </DetailGroup>

                  <DetailGroup icon={ShieldCheck} title="Compliance">
                    <DetailRow label="Trade License" value={companySetting.trade_license} />
                    <DetailRow label="TIN No" value={companySetting.tin_no} />
                    <DetailRow label="BIN No" value={companySetting.bin_no} />
                    <DetailRow label="VAT No" value={companySetting.vat_no} />
                  </DetailGroup>
                </div>
              </section>

              <aside className="space-y-5">
                <section className="glass-card overflow-hidden rounded-[1.5rem]">
                  <div className="border-b border-[var(--line)] px-6 py-5">
                    <h2 className="text-lg font-semibold text-[#1f2440]">Logo</h2>
                  </div>
                  <div className="px-6 py-6">
                    {companySetting.company_logo_object?.download_url ? (
                      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={companySetting.company_logo_object.download_url}
                          alt={`${companySetting.company_name} logo`}
                          className="h-48 w-full object-contain p-4"
                        />
                      </div>
                    ) : (
                      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-white/70 text-sm text-[var(--muted)]">
                        No logo uploaded
                      </div>
                    )}
                    <p className="mt-3 truncate text-sm text-[var(--muted)]">
                      {companySetting.company_logo_object?.original_name ?? companySetting.company_logo ?? "No logo file"}
                    </p>
                  </div>
                </section>

                <section className="glass-card overflow-hidden rounded-[1.5rem]">
                  <div className="border-b border-[var(--line)] px-6 py-5">
                    <h2 className="text-lg font-semibold text-[#1f2440]">Account Options</h2>
                  </div>
                  <div className="space-y-4 px-6 py-6">
                    <OptionRow label="Registration" enabled={companySetting.is_registration_enable} />
                    <OptionRow label="Email Verification" enabled={companySetting.is_email_verification_enable} />
                    <DetailRow label="Created" value={formatDateTime(companySetting.created_at)} />
                    <DetailRow label="Updated" value={formatDateTime(companySetting.updated_at)} />
                  </div>
                </section>

                <Link href="/company-settings">
                  <Button as="span" className="w-full rounded-full">
                    Back
                  </Button>
                </Link>
              </aside>
            </div>
          ) : null}
        </BoneyardSkeleton>
      )}
    </main>
  );
}

function DetailGroup({ children, icon: Icon, title }: { children: React.ReactNode; icon: typeof Building2; title: string }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2 text-[#2d3150]">
        <Icon className="h-4 w-4 text-[var(--accent)]" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-[#2d3150]">{value || "-"}</p>
    </div>
  );
}

function OptionRow({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-[#2d3150]">{label}</span>
      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", enabled ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
        {enabled ? "Enabled" : "Disabled"}
      </span>
    </div>
  );
}

function DetailsFallback() {
  return (
    <div className="mx-auto mt-5 w-full max-w-[1328px]">
      <section className="glass-card overflow-hidden rounded-[1.5rem]">
        <PanelSkeleton lines={10} />
      </section>
    </div>
  );
}

export default function CompanySettingDetailsPage() {
  return (
    <Suspense fallback={<DetailsFallback />}>
      <CompanySettingDetailsContent />
    </Suspense>
  );
}
