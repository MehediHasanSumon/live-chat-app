import { BadgeDollarSign, ShoppingBag, Target, Users } from "lucide-react";

import { DashboardStatCard } from "@/components/admin/dashboard-stat-card";

const stats = [
  {
    title: "Total Revenue",
    value: "$48,295",
    change: "12.5%",
    trend: "up" as const,
    subtitle: "vs last month",
    icon: BadgeDollarSign,
    tone: "emerald" as const,
  },
  {
    title: "Total Orders",
    value: "2,847",
    change: "8.2%",
    trend: "up" as const,
    subtitle: "vs last month",
    icon: ShoppingBag,
    tone: "sky" as const,
  },
  {
    title: "Active Users",
    value: "14,392",
    change: "18.7%",
    trend: "up" as const,
    subtitle: "vs last month",
    icon: Users,
    tone: "amber" as const,
  },
  {
    title: "Conversion Rate",
    value: "3.24%",
    change: "2.4%",
    trend: "down" as const,
    subtitle: "vs last month",
    icon: Target,
    tone: "rose" as const,
  },
];

export function DashboardStatsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <DashboardStatCard key={stat.title} {...stat} />
      ))}
    </div>
  );
}
