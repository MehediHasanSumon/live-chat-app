import { type LucideIcon } from "lucide-react";

export type MessagesMenuItem = {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
};

type MessagesSidebarMenuProps = {
  items: MessagesMenuItem[];
  onClose: () => void;
};

export function MessagesSidebarMenu({ items, onClose }: MessagesSidebarMenuProps) {
  return (
    <div
      role="menu"
      className="absolute -right-24 top-11 z-30 w-[260px] rounded-2xl border border-[var(--line)] bg-white p-2 shadow-[0_20px_50px_rgba(35,37,58,0.12)]"
    >
      {items.map(({ label, icon: Icon, onClick }) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClick?.();
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"
        >
          <Icon className="h-4 w-4 text-[var(--muted)]" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
