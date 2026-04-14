import { Check, CreditCard, Server, ShieldAlert, Truck, UserPlus } from "lucide-react";

const activities = [
  { title: "Order completed", description: "Sarah Chen - $299.00", time: "2 minutes ago", icon: Check, tone: "bg-emerald-100 text-emerald-600" },
  { title: "New user registered", description: "Jordan Lee joined", time: "18 minutes ago", icon: UserPlus, tone: "bg-sky-100 text-sky-600" },
  { title: "Payment received", description: "Invoice #1042 - $599.00", time: "1 hour ago", icon: CreditCard, tone: "bg-amber-100 text-amber-600" },
  { title: "Order shipped", description: "#12450 - Express delivery", time: "2 hours ago", icon: Truck, tone: "bg-violet-100 text-violet-600" },
  { title: "Low stock alert", description: "Wireless Headphones - 3 left", time: "3 hours ago", icon: ShieldAlert, tone: "bg-rose-100 text-rose-600" },
  { title: "Server maintenance", description: "Scheduled for 2:00 AM EST", time: "5 hours ago", icon: Server, tone: "bg-slate-100 text-slate-500" },
];

export function DashboardRecentActivity() {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:p-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
        <p className="mt-1 text-sm text-slate-500">Latest system events</p>
      </div>

      <div className="relative mt-5">
        <div className="absolute bottom-3 left-[15px] top-3 w-px bg-slate-200" />
        <div className="space-y-0">
          {activities.map((activity, index) => {
            const Icon = activity.icon;

            return (
              <div key={activity.title} className={index === activities.length - 1 ? "relative flex gap-4" : "relative flex gap-4 pb-5"}>
                <div className={`relative z-10 flex h-[31px] w-[31px] items-center justify-center rounded-full ring-4 ring-white ${activity.tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-medium text-slate-800">{activity.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{activity.description}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{activity.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
