import { type LucideIcon } from "lucide-react";

type SidebarIconButtonProps = {
  icon: LucideIcon;
  label: string;
};

export function SidebarIconButton({ icon: Icon, label }: SidebarIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex items-center justify-center rounded-2xl bg-white px-2 py-4 transition hover:border-[rgba(96,91,255,0.24)] hover:text-[var(--accent)]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <Icon className="h-4 w-4" />
      </span>
    </button>
  );
}
