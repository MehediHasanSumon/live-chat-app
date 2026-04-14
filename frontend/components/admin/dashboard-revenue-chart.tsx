"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const datasets = {
  yearly: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    current: [18200, 22400, 19800, 28600, 32100, 29400, 35200, 38900, 34500, 42100, 45800, 48295],
    previous: [15200, 18400, 16800, 22600, 25100, 23400, 28200, 30900, 27500, 33100, 36800, 38295],
  },
  monthly: {
    labels: ["W1", "W2", "W3", "W4"],
    current: [9200, 11800, 12600, 14750],
    previous: [7800, 9600, 10500, 12100],
  },
  weekly: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    current: [1800, 2200, 2050, 2600, 2840, 2390, 3100],
    previous: [1500, 1680, 1740, 1980, 2250, 2100, 2460],
  },
} as const;

type Period = keyof typeof datasets;

function buildLinePath(values: readonly number[], width: number, height: number, paddingX: number, paddingY: number) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  return values
    .map((value, index) => {
      const x = paddingX + (index * plotWidth) / Math.max(values.length - 1, 1);
      const y = paddingY + ((max - value) / range) * plotHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildAreaPath(values: readonly number[], width: number, height: number, paddingX: number, paddingY: number) {
  const linePath = buildLinePath(values, width, height, paddingX, paddingY);
  const plotWidth = width - paddingX * 2;
  const lastX = paddingX + plotWidth;
  const baselineY = height - paddingY;

  return `${linePath} L ${lastX} ${baselineY} L ${paddingX} ${baselineY} Z`;
}

export function DashboardRevenueChart() {
  const [period, setPeriod] = useState<Period>("yearly");
  const data = datasets[period];
  const width = 760;
  const height = 320;
  const paddingX = 26;
  const paddingY = 28;
  const combined = [...data.current, ...data.previous];
  const max = Math.max(...combined);
  const min = Math.min(...combined);
  const range = Math.max(max - min, 1);
  const ticks = 4;

  const yTicks = Array.from({ length: ticks + 1 }, (_, index) => {
    const value = min + ((ticks - index) * range) / ticks;
    const y = paddingY + (index * (height - paddingY * 2)) / ticks;

    return { value, y };
  });

  const chart = {
    width,
    height,
    paddingX,
    paddingY,
    yTicks,
    currentLine: buildLinePath(data.current, width, height, paddingX, paddingY),
    currentArea: buildAreaPath(data.current, width, height, paddingX, paddingY),
    previousLine: buildLinePath(data.previous, width, height, paddingX, paddingY),
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:p-6 xl:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Revenue Overview</h2>
          <p className="mt-1 text-sm text-slate-500">Monthly revenue comparison</p>
        </div>

        <div className="flex items-center gap-2">
          {(["yearly", "monthly", "weekly"] as Period[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition",
                period === item ? "bg-[#fff7ed] text-[#ea580c]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center justify-end gap-5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-4 rounded-full bg-[#ea580c]" />
            This Year
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-4 rounded-full bg-slate-400" />
            Last Year
          </span>
        </div>

        <div className="relative h-72 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))]">
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-full w-full" role="img" aria-label="Revenue chart">
            <defs>
              <linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#fdba74" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#fdba74" stopOpacity="0" />
              </linearGradient>
            </defs>

            {chart.yTicks.map((tick) => (
              <g key={tick.y}>
                <line
                  x1={chart.paddingX}
                  x2={chart.width - chart.paddingX}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="rgba(226,232,240,1)"
                  strokeWidth="1"
                />
                <text x="0" y={tick.y + 4} fill="#9ca3af" fontSize="11">
                  ${Math.round(tick.value / 1000)}k
                </text>
              </g>
            ))}

            <path d={chart.currentArea} fill="url(#revenueArea)" />
            <path d={chart.previousLine} fill="none" stroke="#94a3b8" strokeDasharray="6 6" strokeWidth="2.5" />
            <path d={chart.currentLine} fill="none" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" />

            {data.labels.map((label, index) => {
              const x = chart.paddingX + (index * (chart.width - chart.paddingX * 2)) / Math.max(data.labels.length - 1, 1);

              return (
                <text key={label} x={x} y={chart.height - 6} fill="#9ca3af" fontSize="11" textAnchor="middle">
                  {label}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}
