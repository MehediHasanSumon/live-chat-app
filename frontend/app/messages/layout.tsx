import { ReactNode } from "react";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";

type MessagesLayoutProps = {
  children: ReactNode;
};

export default function MessagesLayout({ children }: MessagesLayoutProps) {
  return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
