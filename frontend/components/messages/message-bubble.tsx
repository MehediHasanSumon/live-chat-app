import { type ChatMessage } from "@/lib/messages-data";

type MessageBubbleProps = {
  message: ChatMessage;
  authUserId: number | null;
  onToggleReaction?: (emoji: string, hasReacted: boolean) => void;
  isReacting?: boolean;
};

const quickReactions = ["👍", "❤️", "🔥"];

export function MessageBubble({
  message,
  authUserId,
  onToggleReaction,
  isReacting = false,
}: MessageBubbleProps) {
  return (
    <div className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          message.sender === "me"
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--line)] bg-white text-[var(--foreground)]"
        }`}
      >
        {message.sender === "other" && message.senderName ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            {message.senderName}
          </p>
        ) : null}

        {message.isForwarded ? (
          <p className={`mb-2 text-[11px] ${message.sender === "me" ? "text-white/80" : "text-[var(--muted)]"}`}>
            Forwarded
          </p>
        ) : null}

        {message.quote ? (
          <div
            className={`mb-3 rounded-xl border px-3 py-2 text-xs ${
              message.sender === "me"
                ? "border-white/15 bg-white/10 text-white/85"
                : "border-[var(--line)] bg-[var(--accent-soft)] text-[var(--foreground)]"
            }`}
          >
            {message.quote.senderName ? <p className="font-semibold">{message.quote.senderName}</p> : null}
            <p className="mt-1 line-clamp-2">{message.quote.text}</p>
          </div>
        ) : null}

        {message.gifUrl ? (
          <a
            href={message.gifUrl}
            target="_blank"
            rel="noreferrer"
            className={`mb-3 block rounded-2xl border px-3 py-3 text-xs ${
              message.sender === "me"
                ? "border-white/15 bg-white/10 text-white"
                : "border-[var(--line)] bg-[var(--accent-soft)] text-[var(--foreground)]"
            }`}
          >
            Open GIF
          </a>
        ) : null}

        <p>{message.body}</p>

        {message.attachments?.length ? (
          <div className="mt-3 space-y-2">
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.downloadUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className={`block rounded-xl border px-3 py-2 text-xs ${
                  message.sender === "me"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-[var(--line)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                }`}
              >
                <p className="truncate font-medium">{attachment.name}</p>
                <p className={message.sender === "me" ? "text-white/75" : "text-[var(--muted)]"}>
                  {attachment.isExpired
                    ? attachment.placeholderText ?? "File expired / removed by storage policy"
                    : `${Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB`}
                </p>
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {quickReactions.map((emoji) => {
            const hasReacted = Boolean(
              message.reactions?.some((reaction) => reaction.emoji === emoji && reaction.userIds.includes(authUserId ?? -1)),
            );

            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction?.(emoji, hasReacted)}
                disabled={isReacting}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  hasReacted
                    ? message.sender === "me"
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : message.sender === "me"
                      ? "border-white/20 bg-transparent text-white/85"
                      : "border-[var(--line)] bg-white text-[var(--foreground)]"
                }`}
              >
                {emoji}
              </button>
            );
          })}

          {message.reactions?.length ? (
            <div className={`flex flex-wrap gap-2 text-xs ${message.sender === "me" ? "text-white/80" : "text-[var(--muted)]"}`}>
              {message.reactions.map((reaction) => (
                <span key={reaction.emoji} className="rounded-full bg-black/5 px-2 py-1">
                  {reaction.emoji} {reaction.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <p className={`mt-1 text-[11px] ${message.sender === "me" ? "text-white/75" : "text-[var(--muted)]"}`}>
          {message.time}
          {message.isEdited ? " · Edited" : ""}
        </p>
      </div>
    </div>
  );
}
