import { ReactNode } from "react";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
