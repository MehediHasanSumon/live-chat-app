import { Ellipsis, SquarePen } from "lucide-react";

import {
  MessagesSidebarMenu,
  type MessagesMenuItem,
} from "@/components/messages/messages-sidebar-menu";

type MessagesSidebarHeaderProps = {
  title?: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  menuItems: MessagesMenuItem[];
  onCloseMenu: () => void;
  onComposeClick?: () => void;
};

export function MessagesSidebarHeader({
  title = "Messages",
  isMenuOpen,
  onToggleMenu,
  menuItems,
  onCloseMenu,
  onComposeClick,
}: MessagesSidebarHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="truncate text-[1.15rem] font-semibold tracking-tight text-[var(--foreground)]">{title}</p>
      <div className="relative flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleMenu}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label="Open message list options"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--muted)] transition hover:border-[rgba(96,91,255,0.24)] hover:text-[var(--accent)]"
        >
          <Ellipsis className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onComposeClick}
          aria-label="Start a new conversation"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(96,91,255,0.14)] bg-[linear-gradient(135deg,rgba(96,91,255,0.12)_0%,rgba(96,91,255,0.02)_100%)] text-[var(--accent)] shadow-[0_10px_22px_rgba(96,91,255,0.08)] transition hover:border-[rgba(96,91,255,0.28)] hover:bg-[linear-gradient(135deg,rgba(96,91,255,0.18)_0%,rgba(96,91,255,0.06)_100%)] hover:text-[var(--accent-strong)]"
        >
          <SquarePen className="h-4 w-4" />
        </button>

        {isMenuOpen ? <MessagesSidebarMenu items={menuItems} onClose={onCloseMenu} /> : null}
      </div>
    </div>
  );
}
