import { ChevronLeft, ChevronRight } from "lucide-react";

import { AppAvatar } from "@/components/ui/app-avatar";

const orders = [
  { id: "#12458", customer: "Sarah Chen", product: "Pro Plan", amount: "$299.00", status: "Completed", tone: "emerald", date: "Jan 15, 2025" },
  { id: "#12457", customer: "Marcus Johnson", product: "Basic Plan", amount: "$49.00", status: "Pending", tone: "amber", date: "Jan 15, 2025" },
  { id: "#12456", customer: "Emily Davis", product: "Enterprise", amount: "$599.00", status: "Completed", tone: "emerald", date: "Jan 14, 2025" },
  { id: "#12455", customer: "Alex Rivera", product: "Pro Plan", amount: "$299.00", status: "Cancelled", tone: "red", date: "Jan 14, 2025" },
  { id: "#12454", customer: "Jordan Lee", product: "Basic Plan", amount: "$49.00", status: "Processing", tone: "sky", date: "Jan 13, 2025" },
];

const toneClasses = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  sky: "bg-sky-50 text-sky-700",
};

export function DashboardRecentOrders() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:col-span-2">
      <div className="flex items-center justify-between px-5 pb-0 pt-5 lg:px-6 lg:pt-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Recent Orders</h2>
          <p className="mt-1 text-sm text-slate-500">Latest transactions overview</p>
        </div>
        <button type="button" className="text-sm font-semibold text-[#ea580c] transition hover:text-[#c2410c]">
          View All
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="border-t border-slate-100">
              {["Order", "Customer", "Product", "Amount", "Status", "Date"].map((heading) => (
                <th
                  key={heading}
                  className="px-5 pb-3 pt-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orders.map((order) => (
              <tr key={order.id} className="transition hover:bg-slate-50/80">
                <td className="px-5 py-3.5 text-sm font-semibold text-slate-900">{order.id}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <AppAvatar
                      name={order.customer}
                      sizeClass="h-8 w-8"
                      textClass="text-xs"
                      fallbackClassName="bg-slate-900 text-white"
                    />
                    <span className="text-sm text-slate-700">{order.customer}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm text-slate-600">{order.product}</td>
                <td className="px-5 py-3.5 text-sm font-semibold text-slate-900">{order.amount}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      toneClasses[order.tone as keyof typeof toneClasses]
                    }`}
                  >
                    {order.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm text-slate-500">{order.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-700">1-5</span> of <span className="font-semibold text-slate-700">248</span>
        </p>
        <div className="flex items-center gap-1">
          <button type="button" disabled className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#ea580c] text-xs font-semibold text-white">
            1
          </button>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium text-slate-600 transition hover:bg-slate-100">
            2
          </button>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium text-slate-600 transition hover:bg-slate-100">
            3
          </button>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
