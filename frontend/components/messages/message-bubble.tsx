import { type ChatMessage } from "@/lib/messages-data";

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
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
                  {Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB
                </p>
              </a>
            ))}
          </div>
        ) : null}

        <p className={`mt-1 text-[11px] ${message.sender === "me" ? "text-white/75" : "text-[var(--muted)]"}`}>
          {message.time}
          {message.isEdited ? " · Edited" : ""}
        </p>
      </div>
    </div>
  );
}
