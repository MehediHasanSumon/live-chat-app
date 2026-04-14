import { ReactNode } from "react";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";

type ProtectedLayoutProps = {
  children: ReactNode;
};

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
