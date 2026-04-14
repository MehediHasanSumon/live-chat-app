import { Download, Sparkles } from "lucide-react";

export function DashboardPageHeader() {
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#ea580c] shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Nexus dashboard
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-[-0.04em] text-[#111827] lg:text-3xl">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">Welcome back, Alex. Here&apos;s what&apos;s happening today.</p>
        </div>

        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ea580c] px-4 text-sm font-semibold text-white transition hover:bg-[#c2410c]"
        >
          <Download className="h-4 w-4" />
          Export report
        </button>
      </div>
    </div>
  );
}
