"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PencilLine, Send, SmilePlus, Trash2, X } from "lucide-react";

import { type ChatMessage } from "@/lib/messages-data";

type MessageBubbleProps = {
  message: ChatMessage;
  authUserId: number | null;
  readLabel?: string | null;
  onToggleReaction?: (emoji: string, hasReacted: boolean) => void;
  onEdit?: () => void;
  onForward?: () => void;
  onRemove?: () => void;
  isReacting?: boolean;
};

const quickReactions = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F525}", "\u{1F602}", "\u{1F62E}"];

export function MessageBubble({
  message,
  authUserId,
  readLabel = null,
  onToggleReaction,
  onEdit,
  onForward,
  onRemove,
  isReacting = false,
}: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const railPositionClass = message.sender === "me"
    ? "right-full mr-3"
    : "left-full ml-3";

  const surfaceActionClass =
    "flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(111,123,176,0.14)] bg-white/96 text-[#6f769b] shadow-[0_10px_20px_rgba(96,109,160,0.07)] transition hover:border-[rgba(96,91,255,0.18)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60";

  const reactionSummaryClass = "bg-transparent";

  const renderedReactionBadges = useMemo(
    () =>
      message.reactions?.map((reaction) => (
        <span key={reaction.emoji} className={`rounded-full px-2 py-1 ${reactionSummaryClass}`}>
          {reaction.emoji} {reaction.count}
        </span>
      )) ?? [],
    [message.reactions, reactionSummaryClass],
  );

  useEffect(() => {
    if (!showReactionPicker) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!bubbleRef.current?.contains(event.target as Node)) {
        setShowReactionPicker(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showReactionPicker]);

  return (
    <div
      ref={bubbleRef}
      className={`group flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}
      onMouseLeave={() => setShowReactionPicker(false)}
    >
      <div className={`relative max-w-[78%] ${renderedReactionBadges.length > 0 ? "pb-5" : ""}`}>
        <div
          className={`pointer-events-none absolute top-1/2 z-20 hidden -translate-y-1/2 items-center gap-2 transition md:flex ${railPositionClass} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`}
        >
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReactionPicker((current) => !current)}
                className={surfaceActionClass}
                aria-label="React to message"
              >
                {showReactionPicker ? <X className="h-3.5 w-3.5" /> : <SmilePlus className="h-3.5 w-3.5" />}
              </button>

              {showReactionPicker ? (
                <div className="absolute top-1/2 z-30 flex -translate-y-1/2 items-center gap-1 rounded-full border border-[rgba(111,123,176,0.14)] bg-white/98 px-2 py-1 shadow-[0_18px_40px_rgba(96,109,160,0.12)]">
                  {quickReactions.map((emoji) => {
                    const hasReacted = Boolean(
                      message.reactions?.some(
                        (reaction) => reaction.emoji === emoji && reaction.userIds.includes(authUserId ?? -1),
                      ),
                    );

                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onToggleReaction?.(emoji, hasReacted);
                          setShowReactionPicker(false);
                        }}
                        disabled={isReacting}
                        className={`rounded-full px-2 py-1 text-sm transition ${
                          hasReacted ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "hover:bg-[var(--accent-soft)]"
                        }`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {onForward ? (
              <button type="button" onClick={onForward} className={surfaceActionClass} aria-label="Forward message">
                  <Send className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {message.canEdit && onEdit ? (
              <button type="button" onClick={onEdit} className={surfaceActionClass} aria-label="Edit message">
                  <PencilLine className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {onRemove ? (
              <button type="button" onClick={onRemove} className={surfaceActionClass} aria-label="Remove message">
                  <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={`rounded-[26px] px-4 py-3 text-sm leading-5 shadow-[0_14px_36px_rgba(96,109,160,0.06)] ${
            message.sender === "me"
              ? "bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] text-white"
              : "border border-[rgba(111,123,176,0.14)] bg-white text-[var(--foreground)]"
          }`}
        >
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

          <p className="leading-5">{message.body}</p>

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

          <p className={`mt-1 text-[11px] leading-none ${message.sender === "me" ? "text-white/75" : "text-[var(--muted)]"}`}>
            {message.time}
            {message.isEdited ? " · Edited" : ""}
            {message.sender === "me" && readLabel ? ` · ${readLabel}` : ""}
          </p>
        </div>

        {renderedReactionBadges.length > 0 ? (
          <div
            className={`absolute bottom-0 z-10 flex flex-wrap gap-1 text-xs ${
              message.sender === "me" ? "right-3 justify-end text-white/80" : "left-3 text-[var(--muted)]"
            }`}
          >
            {renderedReactionBadges}
          </div>
        ) : null}
      </div>
    </div>
  );
}
