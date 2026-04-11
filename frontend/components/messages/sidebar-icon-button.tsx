import { type LucideIcon } from "lucide-react";

type SidebarIconButtonProps = {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
};

export function SidebarIconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  active = false,
}: SidebarIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="flex items-center justify-center rounded-2xl bg-white px-2 py-4 transition hover:border-[rgba(96,91,255,0.24)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-transparent disabled:hover:text-inherit"
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          active
            ? "bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] text-white shadow-[0_12px_24px_rgba(96,91,255,0.18)]"
            : "bg-[var(--accent-soft)] text-[var(--accent)]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
    </button>
  );
}
