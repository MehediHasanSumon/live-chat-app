"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu, PanelLeftOpen, Settings, User } from "lucide-react";

import { AppAvatar } from "@/components/ui/app-avatar";
import { useLogoutMutation } from "@/lib/hooks/use-auth-mutations";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

type AdminDashboardTopbarProps = {
  isSidebarCollapsed: boolean;
  onOpenSidebar: () => void;
  onToggleSidebar: () => void;
};

export function AdminDashboardTopbar({
  isSidebarCollapsed,
  onOpenSidebar,
  onToggleSidebar,
}: AdminDashboardTopbarProps) {
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogoutMutation({ clearAuthenticatedOnSuccess: false });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const displayName = user?.name?.trim() || user?.username || "Guest User";
  const displayUsername = user?.username ? `@${user.username}` : "@guest";
  const avatarUrl = user?.avatar_object?.download_url ?? null;

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
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

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    setIsProfileOpen(false);
    window.location.replace("/login");
  }

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
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsProfileOpen((current) => !current);
            }}
            className="flex items-center gap-2.5 rounded-xl py-1.5 pl-2 pr-3 transition hover:bg-slate-100"
            aria-label="User menu"
          >
            <AppAvatar
              name={displayName}
              imageUrl={avatarUrl}
              sizeClass="h-8 w-8"
              textClass="text-xs"
              radiusClassName="rounded-lg"
              fallbackClassName="bg-[linear-gradient(135deg,#111827,#334155)] text-white"
              className={!avatarUrl ? "tracking-[0.02em]" : undefined}
              alt={`${displayName} avatar`}
            />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-800">{displayName}</p>
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
              <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500">{displayUsername}</p>
            </div>
            <div className="py-1.5">
              <Link href="/profile" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                <User className="h-4 w-4 text-slate-400" />
                My Profile
              </Link>
              <Link href="/settings" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                <Settings className="h-4 w-4 text-slate-400" />
                Account Settings
              </Link>
            </div>
            <div className="border-t border-slate-100 py-1.5">
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LogOut className="h-4 w-4" />
                {logoutMutation.isPending ? "Signing Out..." : "Sign Out"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
