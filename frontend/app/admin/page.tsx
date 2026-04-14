import { DashboardPageHeader } from "@/components/admin/dashboard-page-header";
import { DashboardRecentActivity } from "@/components/admin/dashboard-recent-activity";
import { DashboardRecentOrders } from "@/components/admin/dashboard-recent-orders";
import { DashboardRevenueChart } from "@/components/admin/dashboard-revenue-chart";
import { DashboardStatsGrid } from "@/components/admin/dashboard-stats-grid";
import { DashboardTrafficSources } from "@/components/admin/dashboard-traffic-sources";

export default function AdminDashboardPage() {
  return (
    <>
      <DashboardPageHeader />
      <DashboardStatsGrid />

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashboardRevenueChart />
        <DashboardTrafficSources />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashboardRecentOrders />
        <DashboardRecentActivity />
      </div>

      <footer className="mt-8 border-t border-slate-200/60 pt-6 text-center">
        <p className="text-sm text-slate-400">2025 Nexus Admin Panel. Built with precision.</p>
      </footer>
    </>
  );
}
