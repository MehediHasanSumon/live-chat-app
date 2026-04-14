"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, PanelLeftOpen, Search, Settings, User } from "lucide-react";

import { cn } from "@/lib/utils";

type AdminDashboardTopbarProps = {
  isSidebarCollapsed: boolean;
  onOpenSidebar: () => void;
  onToggleSidebar: () => void;
};

const notifications = [
  {
    title: "Order #12458 completed",
    detail: "Payment of $299.00 received",
    time: "2 min ago",
    border: "border-[#ea580c]",
    icon: "bg-emerald-100 text-emerald-600",
    marker: "✓",
  },
  {
    title: "New user registered",
    detail: "Jordan Lee created an account",
    time: "18 min ago",
    border: "border-sky-400",
    icon: "bg-sky-100 text-sky-600",
    marker: "+",
  },
  {
    title: "Low stock alert",
    detail: "Wireless Headphones: 3 left",
    time: "1 hr ago",
    border: "border-amber-400",
    icon: "bg-amber-100 text-amber-600",
    marker: "!",
  },
  {
    title: "Server update scheduled",
    detail: "Maintenance at 2:00 AM EST",
    time: "3 hrs ago",
    border: "border-violet-400",
    icon: "bg-violet-100 text-violet-600",
    marker: "•",
  },
];

export function AdminDashboardTopbar({
  isSidebarCollapsed,
  onOpenSidebar,
  onToggleSidebar,
}: AdminDashboardTopbarProps) {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsNotificationOpen(false);
        setIsProfileOpen(false);
      }
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsNotificationOpen(false);
        setIsProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur-xl lg:px-6" ref={rootRef}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-slate-100 lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5 text-slate-600" />
        </button>

        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden h-10 w-10 items-center justify-center rounded-lg transition hover:bg-slate-100 lg:inline-flex"
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeftOpen className={cn("h-5 w-5 text-slate-600 transition", isSidebarCollapsed && "rotate-180")} />
        </button>

        <div className="relative hidden items-center md:flex">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search anything..."
            className="h-10 w-64 rounded-xl border border-transparent bg-slate-100/70 pl-10 pr-16 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#ea580c]/30 focus:bg-white focus:ring-2 focus:ring-[#ea580c]/10 lg:w-80"
          />
          <kbd className="absolute right-3 hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 lg:inline-flex">
            Ctrl K
          </kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-slate-100 md:hidden"
          aria-label="Search"
        >
          <Search className="h-4.5 w-4.5 text-slate-600" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsProfileOpen(false);
              setIsNotificationOpen((current) => !current);
            }}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-slate-100"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5 text-slate-600" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ea580c] ring-2 ring-white" />
          </button>

          <div
            className={cn(
              "absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50 transition",
              isNotificationOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0",
            )}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
              <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#ea580c]">4 New</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.map((notification) => (
                <div key={notification.title} className={`cursor-pointer border-l-2 px-4 py-3 transition hover:bg-slate-50 ${notification.border}`}>
                  <div className="flex gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs ${notification.icon}`}>
                      {notification.marker}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{notification.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{notification.detail}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{notification.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5">
              <button type="button" className="block w-full text-center text-sm font-semibold text-[#ea580c] transition hover:text-[#c2410c]">
                View all notifications
              </button>
            </div>
          </div>
        </div>

        <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsNotificationOpen(false);
              setIsProfileOpen((current) => !current);
            }}
            className="flex items-center gap-2.5 rounded-xl py-1.5 pl-2 pr-3 transition hover:bg-slate-100"
            aria-label="User menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#111827,#334155)] text-xs font-semibold text-white">
              AM
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-800">Alex Morgan</p>
              <p className="text-[11px] leading-tight text-slate-500">Administrator</p>
            </div>
            <ChevronDown className="hidden h-3 w-3 text-slate-400 sm:block" />
          </button>

          <div
            className={cn(
              "absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50 transition",
              isProfileOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0",
            )}
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Alex Morgan</p>
              <p className="text-xs text-slate-500">alex@nexus.io</p>
            </div>
            <div className="py-1.5">
              <Link href="/settings" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                <User className="h-4 w-4 text-slate-400" />
                My Profile
              </Link>
              <Link href="/settings" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                <Settings className="h-4 w-4 text-slate-400" />
                Account Settings
              </Link>
            </div>
            <div className="border-t border-slate-100 py-1.5">
              <Link href="/" className="flex items-center gap-3 px-4 py-2 text-sm text-rose-600 transition hover:bg-rose-50">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
