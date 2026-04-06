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
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--muted)] transition hover:border-[rgba(96,91,255,0.24)] hover:text-[var(--accent)]"
        >
          <SquarePen className="h-4 w-4" />
        </button>

        {isMenuOpen ? <MessagesSidebarMenu items={menuItems} onClose={onCloseMenu} /> : null}
      </div>
    </div>
  );
}
