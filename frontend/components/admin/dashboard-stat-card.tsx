import { type LucideIcon } from "lucide-react";

type DashboardStatCardProps = {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  subtitle: string;
  icon: LucideIcon;
  tone: "emerald" | "sky" | "amber" | "rose";
};

const toneStyles = {
  emerald: {
    iconBox: "bg-emerald-50 text-emerald-600",
    pill: "bg-emerald-50 text-emerald-700",
  },
  sky: {
    iconBox: "bg-sky-50 text-sky-600",
    pill: "bg-sky-50 text-sky-700",
  },
  amber: {
    iconBox: "bg-amber-50 text-amber-600",
    pill: "bg-amber-50 text-amber-700",
  },
  rose: {
    iconBox: "bg-rose-50 text-rose-600",
    pill: "bg-rose-50 text-rose-700",
  },
};

export function DashboardStatCard({
  title,
  value,
  change,
  trend,
  subtitle,
  icon: Icon,
  tone,
}: DashboardStatCardProps) {
  const styles = toneStyles[tone];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,rgba(255,255,255,0.36)_50%,transparent_60%)]" />
      </div>

      <div className="relative flex items-start justify-between gap-4">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${styles.iconBox}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${styles.pill}`}>
          <span>{trend === "up" ? "↑" : "↓"}</span>
          {change}
        </span>
      </div>

      <p className="relative mt-4 text-sm font-medium text-slate-500">{title}</p>
      <p className="relative mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-900">{value}</p>
      <p className="relative mt-2 text-xs text-slate-400">{subtitle}</p>
    </article>
  );
}
