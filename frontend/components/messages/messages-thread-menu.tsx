import { type LucideIcon } from "lucide-react";

type MenuItem = {
  label: string;
  icon: LucideIcon;
};

type MessagesThreadMenuProps = {
  items: MenuItem[];
  onClose: () => void;
};

export function MessagesThreadMenu({ items, onClose }: MessagesThreadMenuProps) {
  return (
    <div
      role="menu"
      className="absolute -right-10 top-14 z-20 w-[260px] rounded-2xl border border-[var(--line)] bg-white p-2 shadow-[0_20px_50px_rgba(35,37,58,0.12)]"
    >
      {items.map(({ label, icon: Icon }) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          onClick={onClose}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"
        >
          <Icon className="h-4 w-4 text-[var(--muted)]" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
