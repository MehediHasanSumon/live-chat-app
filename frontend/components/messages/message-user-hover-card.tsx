"use client";

import { MessageAvatar } from "@/components/messages/message-avatar";

type MessageUserHoverCardProps = {
  name: string;
  username?: string | null;
  imageUrl?: string | null;
};

export function MessageUserHoverCard({
  name,
  username,
  imageUrl = null,
}: MessageUserHoverCardProps) {
  const senderHandle = username?.trim() ? `@${username.trim()}` : null;

  return (
    <div className="absolute bottom-full left-0 z-30 mb-3 min-w-[220px] rounded-[22px] border border-[rgba(111,123,176,0.14)] bg-white/98 p-3 shadow-[0_22px_44px_rgba(61,72,120,0.14)] backdrop-blur">
      <div className="flex items-center gap-3">
        <MessageAvatar
          name={name}
          imageUrl={imageUrl}
          sizeClass="h-12 w-12"
          textClass="text-sm"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#2f3655]">{name}</p>
          {senderHandle ? (
            <p className="truncate text-xs text-[#8f97bb]">{senderHandle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
