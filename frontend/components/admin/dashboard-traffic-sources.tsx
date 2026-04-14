const sources = [
  { label: "Direct", value: 35, color: "#ea580c" },
  { label: "Organic", value: 30, color: "#10b981" },
  { label: "Referral", value: 20, color: "#0ea5e9" },
  { label: "Social", value: 15, color: "#8b5cf6" },
];

export function DashboardTrafficSources() {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:p-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Traffic Sources</h2>
        <p className="mt-1 text-sm text-slate-500">Where visitors come from</p>
      </div>

      <div className="mt-6 flex items-center justify-center">
        <div className="relative h-56 w-56">
          <div
            className="h-full w-full rounded-full"
            style={{
              background:
                "conic-gradient(#ea580c 0% 35%, #10b981 35% 65%, #0ea5e9 65% 85%, #8b5cf6 85% 100%)",
            }}
          />
          <div className="absolute inset-[22%] flex items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.8)]">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total</p>
              <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-900">100%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {sources.map((source) => (
          <div key={source.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: source.color }} />
              <span className="text-sm text-slate-600">{source.label}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">{source.value}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
