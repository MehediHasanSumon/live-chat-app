"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, House, LogOut, MessageSquare, Settings, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";

type AdminDashboardSidebarProps = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof House;
  badge?: string;
};

const mainItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: House },
  { href: "/messages", label: "Messages", icon: MessageSquare, badge: "3" },
];

const settingsItems = ["General", "Security", "Notifications"];

function SidebarLink({
  item,
  pathname,
  isCollapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  isCollapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const isActive =
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === "/messages" && pathname.startsWith("/messages"));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
        isActive ? "bg-[#1e222d] text-white" : "text-slate-400 hover:bg-[#191c24] hover:text-white",
      )}
    >
      {isActive ? <span className="absolute left-0 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-r bg-[#ea580c]" /> : null}
      <div className={cn("flex min-w-0 flex-1 items-center", isCollapsed ? "justify-center lg:justify-center" : "justify-start")}>
        <Icon className={cn("h-[15px] w-5 shrink-0", isCollapsed ? "mr-0" : "mr-3", isActive ? "text-[#ea580c]" : "group-hover:text-[#ea580c]")} />
        <span className={cn("whitespace-nowrap text-sm font-medium", isCollapsed ? "hidden lg:hidden" : "inline")}>{item.label}</span>
        {item.badge ? (
          <span
            className={cn(
              "ml-auto rounded-full bg-[#ea580c] px-2 py-0.5 text-[11px] font-semibold leading-none text-white",
              isCollapsed ? "absolute right-1.5 top-1.5 hidden lg:inline-flex" : "inline-flex",
            )}
          >
            {item.badge}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function AdminDashboardSidebar({ isCollapsed, isMobileOpen, onCloseMobile }: AdminDashboardSidebarProps) {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 opacity-0 backdrop-blur-[2px] transition lg:hidden",
          isMobileOpen && "opacity-100",
          !isMobileOpen && "pointer-events-none",
        )}
        onClick={onCloseMobile}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col overflow-hidden bg-[linear-gradient(180deg,#111420_0%,#0c0e13_100%)] text-white transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isCollapsed ? "lg:w-[76px]" : "lg:w-[260px]",
        )}
      >
        <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ea580c]">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <span className={cn("ml-3 whitespace-nowrap text-lg font-bold tracking-tight", isCollapsed ? "hidden lg:hidden" : "inline")}>Nexus</span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 lg:hidden"
            aria-label="Close admin sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className={cn("mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500", isCollapsed ? "hidden lg:hidden" : "block")}>
            Main
          </p>

          <div className="space-y-0.5">
            {mainItems.map((item) => (
              <SidebarLink key={item.label} item={item} pathname={pathname} isCollapsed={isCollapsed} onNavigate={onCloseMobile} />
            ))}
          </div>

          <p className={cn("mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500", isCollapsed ? "hidden lg:hidden" : "block")}>
            Management
          </p>

          <SidebarLink
            item={{ href: "/settings", label: "Users", icon: Users }}
            pathname={pathname}
            isCollapsed={isCollapsed}
            onNavigate={onCloseMobile}
          />

          <div className="mt-0.5">
            <button
              type="button"
              onClick={() => setIsSettingsOpen((current) => !current)}
              className="group relative flex w-full items-center rounded-lg px-3 py-2.5 text-slate-400 transition hover:bg-[#191c24] hover:text-white"
            >
              <div className={cn("flex min-w-0 flex-1 items-center", isCollapsed ? "justify-center lg:justify-center" : "justify-start")}>
                <Settings className={cn("h-[15px] w-5 shrink-0", isCollapsed ? "mr-0" : "mr-3", "group-hover:text-[#ea580c]")} />
                <span className={cn("whitespace-nowrap text-sm font-medium", isCollapsed ? "hidden lg:hidden" : "inline")}>Settings</span>
              </div>
              <ChevronDown
                className={cn("ml-2 h-3.5 w-3.5 transition", isSettingsOpen && "rotate-180", isCollapsed ? "hidden lg:hidden" : "inline")}
              />
            </button>

            {isSettingsOpen && !isCollapsed ? (
              <div className="pl-5">
                {settingsItems.map((item) => (
                  <Link
                    key={item}
                    href="/settings"
                    onClick={onCloseMobile}
                    className="flex items-center rounded-md px-3 py-2 text-sm text-slate-500 transition hover:bg-[#191c24] hover:text-[#ea580c]"
                  >
                    <span className="mr-3 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
                    <span>{item}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mx-2 my-4 border-t border-white/[0.06]" />
          <SidebarLink
            item={{ href: "/", label: "Sign Out", icon: LogOut }}
            pathname={pathname}
            isCollapsed={isCollapsed}
            onNavigate={onCloseMobile}
          />
        </nav>

        <div className="shrink-0 border-t border-white/[0.06] p-3">
          <div className="flex items-center rounded-lg bg-[#191c24] px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white ring-2 ring-white/10">
              AM
            </div>
            <div className={cn("ml-3 min-w-0", isCollapsed ? "hidden lg:hidden" : "block")}>
              <p className="truncate text-sm font-semibold text-white">Alex Morgan</p>
              <p className="truncate text-[11px] text-slate-500">alex@nexus.io</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
