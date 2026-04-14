"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { AdminDashboardSidebar } from "@/components/admin/admin-dashboard-sidebar";
import { AdminDashboardTopbar } from "@/components/admin/admin-dashboard-topbar";
import { cn } from "@/lib/utils";

type AdminDashboardShellProps = {
  children: ReactNode;
};

export function AdminDashboardShell({ children }: AdminDashboardShellProps) {
  const pathname = usePathname();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMobileSidebarOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setIsMobileSidebarOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setIsSidebarCollapsed(pathname.startsWith("/messages"));
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#f3f4f8] text-slate-800">
      <AdminDashboardSidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onExpandDesktop={() => setIsSidebarCollapsed(false)}
      />

      <div
        className={cn(
          "min-h-screen transition-[margin] duration-300",
          isSidebarCollapsed ? "lg:ml-[64px]" : "lg:ml-[300px]",
        )}
      >
        <AdminDashboardTopbar
          isSidebarCollapsed={isSidebarCollapsed}
          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
