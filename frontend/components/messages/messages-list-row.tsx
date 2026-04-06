import { type LucideIcon } from "lucide-react";

type MessagesListRowProps = {
  label: string;
  icon: LucideIcon;
  trailing?: string;
  onClick?: () => void;
};

export function MessagesListRow({ label, icon: Icon, trailing, onClick }: MessagesListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition hover:text-[var(--accent)]"
    >
      <Icon className="h-4 w-4 shrink-0 text-[var(--muted)]" />
      <span className="flex-1 text-[13px]">{label}</span>
      {trailing ? <span className="text-xs text-[var(--muted)]">{trailing}</span> : null}
    </button>
  );
}
