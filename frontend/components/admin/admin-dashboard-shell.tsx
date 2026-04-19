"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { AdminDashboardSidebar } from "@/components/admin/admin-dashboard-sidebar";
import { AdminDashboardTopbar } from "@/components/admin/admin-dashboard-topbar";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

type AdminDashboardShellProps = {
  children: ReactNode;
};

function ShellBone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-slate-200/80", className)} />;
}

function AdminDashboardShellSkeleton({ isSidebarCollapsed }: { isSidebarCollapsed: boolean }) {
  return (
    <div className="min-h-screen bg-[#f3f4f8] text-slate-800">
      <aside
        className={cn(
          "fixed left-0 top-0 hidden h-screen flex-col overflow-hidden bg-[linear-gradient(180deg,#111420_0%,#0c0e13_100%)] lg:flex",
          isSidebarCollapsed ? "w-[64px]" : "w-[300px]",
        )}
      >
        <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
          <div className="h-9 w-9 rounded-lg bg-[#ea580c]" />
          {!isSidebarCollapsed ? <ShellBone className="ml-3 h-5 w-24 bg-white/10" /> : null}
        </div>

        <div className="flex-1 space-y-3 px-3 py-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={`sidebar-skeleton-${index}`} className="flex items-center rounded-lg px-3 py-2.5">
              <ShellBone className="h-5 w-5 shrink-0 rounded-md bg-white/10" />
              {!isSidebarCollapsed ? <ShellBone className="ml-3 h-4 w-28 bg-white/10" /> : null}
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] p-3">
          <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "rounded-lg bg-[#191c24] px-3 py-2.5")}>
            <ShellBone className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
            {!isSidebarCollapsed ? (
              <div className="ml-3 min-w-0 flex-1 space-y-2">
                <ShellBone className="h-3 w-24 bg-white/10" />
                <ShellBone className="h-3 w-16 bg-white/10" />
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "min-h-screen transition-[margin] duration-300",
          isSidebarCollapsed ? "lg:ml-[64px]" : "lg:ml-[300px]",
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <ShellBone className="h-10 w-10 rounded-lg lg:hidden" />
            <ShellBone className="hidden h-10 w-10 rounded-lg lg:block" />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-xl py-1.5 pl-2 pr-3">
              <ShellBone className="h-8 w-8 rounded-lg" />
              <div className="hidden space-y-2 sm:block">
                <ShellBone className="h-3 w-28" />
                <ShellBone className="h-3 w-20" />
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-4 lg:p-6">
          <div className="space-y-3">
            <ShellBone className="h-7 w-40 rounded-full" />
            <ShellBone className="h-11 w-56" />
            <ShellBone className="h-5 w-72 max-w-full" />
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`metric-skeleton-${index}`} className="rounded-[1.5rem] border border-slate-200/70 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <ShellBone className="h-11 w-11 rounded-2xl" />
                  <ShellBone className="h-6 w-16 rounded-full" />
                </div>
                <ShellBone className="mt-6 h-4 w-28" />
                <ShellBone className="mt-4 h-8 w-32" />
                <ShellBone className="mt-4 h-4 w-24" />
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div className="rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-3">
                  <ShellBone className="h-6 w-48" />
                  <ShellBone className="h-4 w-40" />
                </div>
                <div className="hidden gap-3 md:flex">
                  <ShellBone className="h-9 w-20 rounded-xl" />
                  <ShellBone className="h-9 w-20 rounded-xl" />
                  <ShellBone className="h-9 w-20 rounded-xl" />
                </div>
              </div>
              <ShellBone className="mt-8 h-[320px] w-full rounded-[1.5rem]" />
            </div>

            <div className="rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="space-y-3">
                <ShellBone className="h-6 w-36" />
                <ShellBone className="h-4 w-40" />
              </div>
              <ShellBone className="mx-auto mt-10 h-56 w-56 rounded-full" />
              <div className="mt-10 space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`legend-skeleton-${index}`} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <ShellBone className="h-3 w-3 rounded-full" />
                      <ShellBone className="h-4 w-20" />
                    </div>
                    <ShellBone className="h-4 w-10" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardShell({ children }: AdminDashboardShellProps) {
  const pathname = usePathname();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const authUser = useAuthStore((state) => state.user);
  const { data: authMe, isFetched, isPending } = useAuthMeQuery(true);

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

  const shouldShowSkeleton = !authUser && (!isFetched || Boolean(authMe?.authenticated && authMe.data.user) || isPending);

  if (shouldShowSkeleton) {
    return <AdminDashboardShellSkeleton isSidebarCollapsed={isSidebarCollapsed} />;
  }

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
        <div className="p-4 lg:p-6">{children}</div>
      </div>
    </div>
  );
}
