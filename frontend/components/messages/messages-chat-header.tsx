import { MoreVertical, Phone, Video } from "lucide-react";

import { type MessageThread } from "@/lib/messages-data";
import { MessageAvatar } from "@/components/messages/message-avatar";

type MessagesChatHeaderProps = {
  thread: MessageThread;
  isInfoSidebarOpen: boolean;
  onToggleInfoSidebar: () => void;
  onStartVoiceCall?: () => void;
  onStartVideoCall?: () => void;
  isStartingVoiceCall?: boolean;
  isStartingVideoCall?: boolean;
};

export function MessagesChatHeader({
  thread,
  isInfoSidebarOpen,
  onToggleInfoSidebar,
  onStartVoiceCall,
  onStartVideoCall,
  isStartingVoiceCall = false,
  isStartingVideoCall = false,
}: MessagesChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MessageAvatar name={thread.name} online={thread.online} />
        <div>
          <p className="text-sm font-semibold sm:text-base">{thread.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[var(--muted)]">
        <button
          type="button"
          onClick={onStartVoiceCall}
          disabled={isStartingVoiceCall}
          aria-label="Start voice call"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white transition hover:border-[rgba(96,91,255,0.28)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Phone className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onStartVideoCall}
          disabled={isStartingVideoCall}
          aria-label="Start video call"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white transition hover:border-[rgba(96,91,255,0.28)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Video className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleInfoSidebar}
          aria-pressed={isInfoSidebarOpen}
          aria-label={
            isInfoSidebarOpen
              ? "Hide conversation info"
              : "Show conversation info"
          }
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white transition hover:border-[rgba(96,91,255,0.28)] hover:text-[var(--accent)]"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
