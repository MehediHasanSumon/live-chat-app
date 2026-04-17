"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, ChevronDown, House, MessageSquare, ReceiptText, ScrollText, Settings, Users, X } from "lucide-react";

import { AppAvatar } from "@/components/ui/app-avatar";
import { usePublicCompanySettingQuery } from "@/lib/hooks/use-public-company-setting";
import { useMessagesBadgeCount } from "@/lib/hooks/use-messages-badge-count";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

type AdminDashboardSidebarProps = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onExpandDesktop: () => void;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof House;
};

type DropdownItem = {
  href: string;
  label: string;
  excludedActivePrefixes?: string[];
};

type DropdownOpenState = "auto" | "open" | "closed";
type SidebarDropdownKey = "invoice" | "business" | "userManagement" | "logs" | "settings";

const mainItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: House },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

const invoiceItems: DropdownItem[] = [
  {
    href: "/invoices",
    label: "Invoices",
    excludedActivePrefixes: ["/invoices/create", "/invoices/daily-statements", "/invoices/monthly-statements"],
  },
  { href: "/invoices/create", label: "Create Invoice" },
  { href: "/invoices/daily-statements", label: "Daily Statements" },
  { href: "/invoices/monthly-statements", label: "Monthly Statements" },
];

const businessItems: DropdownItem[] = [
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/product-units", label: "Product Units" },
  { href: "/product-prices", label: "Product Prices" },
];

const logItems: DropdownItem[] = [
  { href: "/system-log", label: "System Log" },
  { href: "/invoice-sms-logs", label: "SMS Logs" },
];

const userManagementItems: DropdownItem[] = [
  { href: "/users", label: "Users" },
  { href: "/roles", label: "Roles" },
  { href: "/permissions", label: "Permissions" },
];

const settingsItems: DropdownItem[] = [
  { href: "/company-settings", label: "Company Settings" },
  { href: "/sms-credentials", label: "SMS Credentials" },
  { href: "/invoice-sms-templates", label: "SMS Templates" },
  { href: "/ops", label: "System Configuration" },
  { href: "/storage", label: "Storage Configuration" },
];

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isDropdownItemActive(pathname: string, item: DropdownItem) {
  if (!isRouteActive(pathname, item.href)) {
    return false;
  }

  return !(item.excludedActivePrefixes ?? []).some((prefix) => isRouteActive(pathname, prefix));
}

function SidebarLink({
  item,
  pathname,
  isCollapsed,
  onNavigate,
  badge,
}: {
  item: NavItem;
  pathname: string;
  isCollapsed: boolean;
  onNavigate: () => void;
  badge?: string;
}) {
  const Icon = item.icon;
  const isActive = isRouteActive(pathname, item.href);

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
        {badge ? (
          <span
            className={cn(
              "ml-auto rounded-full bg-[#ea580c] px-2 py-0.5 text-[11px] font-semibold leading-none text-white",
              isCollapsed ? "absolute right-1.5 top-1.5 hidden lg:inline-flex" : "inline-flex",
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function SidebarDropdown({
  label,
  icon: Icon,
  items,
  pathname,
  isCollapsed,
  isOpen,
  isHoverOpen,
  onToggle,
  onHoverChange,
  onNavigate,
  onExpandDesktop,
}: {
  label: string;
  icon: typeof House;
  items: DropdownItem[];
  pathname: string;
  isCollapsed: boolean;
  isOpen: boolean;
  isHoverOpen: boolean;
  onToggle: () => void;
  onHoverChange: (value: boolean) => void;
  onNavigate: () => void;
  onExpandDesktop: () => void;
}) {
  const isActive = items.some((item) => isDropdownItemActive(pathname, item));

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        if (isCollapsed) {
          onHoverChange(true);
        }
      }}
      onMouseLeave={() => {
        if (isCollapsed) {
          onHoverChange(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (isCollapsed) {
            onExpandDesktop();
            onHoverChange(false);
          }

          onToggle();
        }}
        className={cn(
          "group relative flex w-full items-center rounded-lg px-3 py-2.5 text-sm transition",
          isActive ? "bg-[#1e222d] text-white" : "text-slate-400 hover:bg-[#191c24] hover:text-white",
        )}
      >
        {isActive ? <span className="absolute left-0 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-r bg-[#ea580c]" /> : null}
        <div className={cn("flex min-w-0 flex-1 items-center", isCollapsed ? "justify-center lg:justify-center" : "justify-start")}>
          <Icon className={cn("h-[15px] w-5 shrink-0", isCollapsed ? "mr-0" : "mr-3", isActive ? "text-[#ea580c]" : "group-hover:text-[#ea580c]")} />
          <span className={cn("whitespace-nowrap text-sm font-medium", isCollapsed ? "hidden lg:hidden" : "inline")}>{label}</span>
        </div>
        <ChevronDown className={cn("ml-2 h-3.5 w-3.5 transition", isOpen && "rotate-180", isCollapsed ? "hidden lg:hidden" : "inline")} />
      </button>

      <div
        className={cn(
          "overflow-hidden pl-5 transition-[max-height,opacity] duration-300 ease-in-out",
          isCollapsed ? "max-h-0 opacity-0" : isOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0",
        )}
        aria-hidden={!isOpen || isCollapsed}
      >
        {items.map((item) => {
          const itemIsActive = isDropdownItemActive(pathname, item);

          return (
            <Link
              key={`${label}-${item.href}-${item.label}`}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center rounded-md px-3 py-2 text-sm transition",
                itemIsActive ? "text-[#ea580c]" : "text-slate-500 hover:bg-[#191c24] hover:text-[#ea580c]",
              )}
            >
              <span className={cn("mr-3 h-1.5 w-1.5 shrink-0 rounded-full", itemIsActive ? "bg-[#ea580c]" : "bg-slate-600")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {isCollapsed && isHoverOpen ? (
        <div className="absolute left-[calc(100%+12px)] top-0 hidden min-w-[220px] rounded-2xl border border-white/10 bg-[#141925] p-3 shadow-[0_24px_60px_rgba(5,8,20,0.4)] lg:block">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <div className="space-y-1">
            {items.map((item) => {
              const itemIsActive = isDropdownItemActive(pathname, item);

              return (
                <Link
                  key={`${label}-hover-${item.href}-${item.label}`}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center rounded-xl px-3 py-2 text-sm transition",
                    itemIsActive ? "bg-white/5 text-[#ea580c]" : "text-slate-300 hover:bg-white/5 hover:text-[#ea580c]",
                  )}
                >
                  <span className={cn("mr-3 h-1.5 w-1.5 shrink-0 rounded-full", itemIsActive ? "bg-[#ea580c]" : "bg-slate-600")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminDashboardSidebar({
  isCollapsed,
  isMobileOpen,
  onCloseMobile,
  onExpandDesktop,
}: AdminDashboardSidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { data: publicCompanySetting, isPending: isCompanySettingPending } = usePublicCompanySettingQuery();
  const { badgeCount } = useMessagesBadgeCount(true);
  const [invoiceOpenState, setInvoiceOpenState] = useState<DropdownOpenState>("auto");
  const [isInvoiceHoverOpen, setIsInvoiceHoverOpen] = useState(false);
  const [businessOpenState, setBusinessOpenState] = useState<DropdownOpenState>("auto");
  const [isBusinessHoverOpen, setIsBusinessHoverOpen] = useState(false);
  const [userManagementOpenState, setUserManagementOpenState] = useState<DropdownOpenState>("auto");
  const [isUserManagementHoverOpen, setIsUserManagementHoverOpen] = useState(false);
  const [logsOpenState, setLogsOpenState] = useState<DropdownOpenState>("auto");
  const [isLogsHoverOpen, setIsLogsHoverOpen] = useState(false);
  const [settingsOpenState, setSettingsOpenState] = useState<DropdownOpenState>("auto");
  const [isSettingsHoverOpen, setIsSettingsHoverOpen] = useState(false);
  const displayName = user?.name?.trim() || user?.username || "Guest User";
  const displayUsername = user?.username ? `@${user.username}` : "@guest";
  const avatarUrl = user?.avatar_object?.download_url ?? null;
  const isCompanyBrandLoading = isCompanySettingPending && !publicCompanySetting;
  const companyName = publicCompanySetting?.company_name?.trim() || "Company";
  const companyLogoUrl = publicCompanySetting?.company_logo_object?.download_url ?? null;
  const invoiceHasActiveItem = invoiceItems.some((item) => isDropdownItemActive(pathname, item));
  const businessHasActiveItem = businessItems.some((item) => isRouteActive(pathname, item.href));
  const userManagementHasActiveItem = userManagementItems.some((item) => isRouteActive(pathname, item.href));
  const logsHasActiveItem = logItems.some((item) => isRouteActive(pathname, item.href));
  const settingsHasActiveItem = settingsItems.some((item) => isRouteActive(pathname, item.href));
  const invoiceOpen = invoiceOpenState === "open" || (invoiceOpenState === "auto" && invoiceHasActiveItem);
  const businessOpen = businessOpenState === "open" || (businessOpenState === "auto" && businessHasActiveItem);
  const userManagementOpen = userManagementOpenState === "open" || (userManagementOpenState === "auto" && userManagementHasActiveItem);
  const logsOpen = logsOpenState === "open" || (logsOpenState === "auto" && logsHasActiveItem);
  const settingsOpen = settingsOpenState === "open" || (settingsOpenState === "auto" && settingsHasActiveItem);

  function toggleDropdown(key: SidebarDropdownKey, nextOpen: boolean) {
    setInvoiceOpenState(key === "invoice" ? (nextOpen ? "open" : "closed") : "closed");
    setBusinessOpenState(key === "business" ? (nextOpen ? "open" : "closed") : "closed");
    setUserManagementOpenState(key === "userManagement" ? (nextOpen ? "open" : "closed") : "closed");
    setLogsOpenState(key === "logs" ? (nextOpen ? "open" : "closed") : "closed");
    setSettingsOpenState(key === "settings" ? (nextOpen ? "open" : "closed") : "closed");
    setIsInvoiceHoverOpen(false);
    setIsBusinessHoverOpen(false);
    setIsUserManagementHoverOpen(false);
    setIsLogsHoverOpen(false);
    setIsSettingsHoverOpen(false);
  }

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
          "fixed left-0 top-0 z-50 flex h-screen w-[300px] flex-col overflow-hidden bg-[linear-gradient(180deg,#111420_0%,#0c0e13_100%)] text-white transition-transform duration-300 lg:overflow-visible",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isCollapsed ? "lg:w-[64px]" : "lg:w-[300px]",
        )}
      >
        <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
          {isCompanyBrandLoading ? (
            <>
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-white/10" />
              <div className={cn("ml-3 h-5 animate-pulse rounded-full bg-white/10", isCollapsed ? "hidden lg:hidden" : "w-28")} />
            </>
          ) : (
            <>
              <AppAvatar
                name={companyName}
                imageUrl={companyLogoUrl}
                sizeClass="h-9 w-9"
                textClass="text-sm"
                radiusClassName="rounded-lg"
                fallbackClassName="bg-[#ea580c] text-white"
                className="shrink-0"
                alt={`${companyName} logo`}
                sizes="36px"
              />
              <span className={cn("ml-3 truncate whitespace-nowrap text-lg font-bold tracking-tight", isCollapsed ? "hidden lg:hidden" : "inline")}>
                {companyName}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 lg:hidden"
            aria-label="Close admin sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 lg:overflow-visible">
          <div className="space-y-0">
            {mainItems.map((item) => (
              <SidebarLink
                key={item.label}
                item={item}
                pathname={pathname}
                isCollapsed={isCollapsed}
                onNavigate={onCloseMobile}
                badge={item.href === "/messages" && badgeCount > 0 ? String(badgeCount) : undefined}
              />
            ))}
          </div>

          <SidebarDropdown
            label="Invoice Management"
            icon={ReceiptText}
            items={invoiceItems}
            pathname={pathname}
            isCollapsed={isCollapsed}
            isOpen={invoiceOpen}
            isHoverOpen={isInvoiceHoverOpen}
            onToggle={() => toggleDropdown("invoice", !invoiceOpen)}
            onHoverChange={setIsInvoiceHoverOpen}
            onNavigate={onCloseMobile}
            onExpandDesktop={onExpandDesktop}
          />

          <SidebarDropdown
            label="Products Management"
            icon={BriefcaseBusiness}
            items={businessItems}
            pathname={pathname}
            isCollapsed={isCollapsed}
            isOpen={businessOpen}
            isHoverOpen={isBusinessHoverOpen}
            onToggle={() => toggleDropdown("business", !businessOpen)}
            onHoverChange={setIsBusinessHoverOpen}
            onNavigate={onCloseMobile}
            onExpandDesktop={onExpandDesktop}
          />

          <SidebarDropdown
            label="User Management"
            icon={Users}
            items={userManagementItems}
            pathname={pathname}
            isCollapsed={isCollapsed}
            isOpen={userManagementOpen}
            isHoverOpen={isUserManagementHoverOpen}
            onToggle={() => toggleDropdown("userManagement", !userManagementOpen)}
            onHoverChange={setIsUserManagementHoverOpen}
            onNavigate={onCloseMobile}
            onExpandDesktop={onExpandDesktop}
          />

          <SidebarDropdown
            label="Logs"
            icon={ScrollText}
            items={logItems}
            pathname={pathname}
            isCollapsed={isCollapsed}
            isOpen={logsOpen}
            isHoverOpen={isLogsHoverOpen}
            onToggle={() => toggleDropdown("logs", !logsOpen)}
            onHoverChange={setIsLogsHoverOpen}
            onNavigate={onCloseMobile}
            onExpandDesktop={onExpandDesktop}
          />

          <SidebarDropdown
            label="Settings"
            icon={Settings}
            items={settingsItems}
            pathname={pathname}
            isCollapsed={isCollapsed}
            isOpen={settingsOpen}
            isHoverOpen={isSettingsHoverOpen}
            onToggle={() => toggleDropdown("settings", !settingsOpen)}
            onHoverChange={setIsSettingsHoverOpen}
            onNavigate={onCloseMobile}
            onExpandDesktop={onExpandDesktop}
          />
        </nav>

        <div className="shrink-0 border-t border-white/[0.06] p-3">
          <div className={cn("flex items-center", isCollapsed ? "justify-center bg-transparent px-0 py-0" : "rounded-lg bg-[#191c24] px-3 py-2.5")}>
            <AppAvatar
              name={displayName}
              imageUrl={avatarUrl}
              sizeClass="h-8 w-8"
              textClass="text-xs"
              fallbackClassName="bg-white/10 text-white"
              className="shrink-0"
              alt={`${displayName} avatar`}
            />
            <div className={cn("ml-3 min-w-0", isCollapsed ? "hidden lg:hidden" : "block")}>
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-[11px] text-slate-500">{displayUsername}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
