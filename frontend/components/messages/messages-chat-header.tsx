import { MoreVertical, Phone, Video } from "lucide-react";

import { type MessageThread } from "@/lib/messages-data";
import { MessageAvatar } from "@/components/messages/message-avatar";

type MessagesChatHeaderProps = {
  thread: MessageThread;
};

export function MessagesChatHeader({ thread }: MessagesChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MessageAvatar name={thread.name} online={thread.online} />
        <div>
          <p className="text-sm font-semibold sm:text-base">{thread.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[var(--muted)]">
        {[Phone, Video, MoreVertical].map((Icon, index) => (
          <button
            key={index}
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white transition hover:border-[rgba(96,91,255,0.28)] hover:text-[var(--accent)]"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </header>
  );
}
