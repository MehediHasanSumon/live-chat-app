"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { CornerUpLeft, Download, FileText, Forward, PencilLine, Send, SmilePlus, Trash2, X } from "lucide-react";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { MessageUserHoverCard } from "@/components/messages/message-user-hover-card";
import { type ChatMessage } from "@/lib/messages-data";

type MessageBubbleProps = {
  message: ChatMessage;
  authUserId: number | null;
  canInteract?: boolean;
  readLabel?: string | null;
  onToggleReaction?: (messageId: number, emoji: string, hasReacted: boolean) => void;
  onOpenImage?: (attachmentId: string) => void;
  onMediaLoad?: () => void;
  onReply?: (messageId: number) => void;
  onEdit?: (messageId: number, currentBody: string) => void;
  onForward?: (messageId: number) => void;
  onRemove?: (messageId: number) => void;
  isReacting?: boolean;
};

const quickReactions = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F525}", "\u{1F602}", "\u{1F62E}"];

function MessageBubbleComponent({
  message,
  authUserId,
  canInteract = true,
  readLabel = null,
  onToggleReaction,
  onOpenImage,
  onMediaLoad,
  onReply,
  onEdit,
  onForward,
  onRemove,
  isReacting = false,
}: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const profileHoverTimeoutRef = useRef<number | null>(null);
  const isOtherMessage = message.sender === "other";
  const senderDisplayName = message.senderName?.trim() || "Unknown user";

  const railPositionClass = message.sender === "me" ? "right-full mr-3" : "left-full ml-3";
  const surfaceActionClass =
    "flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(111,123,176,0.14)] bg-white/96 text-[#6f769b] shadow-[0_10px_20px_rgba(96,109,160,0.07)] transition hover:border-[rgba(96,91,255,0.18)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60";
  const baseBubbleClass =
    message.sender === "me"
      ? "bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] text-white"
      : "border border-[rgba(111,123,176,0.14)] bg-white text-[var(--foreground)]";
  const replyQuoteBubbleClass =
    message.sender === "me"
      ? "bg-[rgba(22,37,86,0.28)] text-white/92"
      : "bg-[rgba(238,240,255,0.9)] text-[var(--foreground)]";
  const replyBodyBubbleClass =
    message.sender === "me"
      ? "ml-auto bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] text-white"
      : "border border-[rgba(111,123,176,0.14)] bg-white text-[var(--foreground)]";

  const renderedReactionBadges = useMemo(
    () =>
      message.reactions?.map((reaction) => (
        <span key={reaction.emoji} className="rounded-full px-2 py-1">
          {reaction.emoji} {reaction.count}
        </span>
      )) ?? [],
    [message.reactions],
  );

  const imageAttachments = message.attachments?.filter((attachment) => attachment.mediaKind === "image") ?? [];
  const fileAttachments = message.attachments?.filter((attachment) => attachment.mediaKind !== "image") ?? [];
  const isImageOnlyMessage =
    imageAttachments.length > 0 &&
    fileAttachments.length === 0 &&
    !message.gifUrl &&
    !message.quote &&
    (!message.body.trim() || /^shared (photo|image)$/i.test(message.body.trim()));
  const isFileOnlyMessage =
    fileAttachments.length > 0 &&
    imageAttachments.length === 0 &&
    !message.gifUrl &&
    !message.quote &&
    !message.body.trim();

  const replyLabel = useMemo(() => {
    if (!message.quote) {
      return null;
    }

    const quotedName = message.quote.senderName?.trim();

    if (message.sender === "me") {
      if (!quotedName || quotedName === "You") {
        return "You replied to yourself";
      }

      return `You replied to ${quotedName}`;
    }

    if (quotedName) {
      return `Replied to ${quotedName}`;
    }

    return "Reply";
  }, [message.quote, message.sender]);

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

  useEffect(() => {
    return () => {
      if (profileHoverTimeoutRef.current) {
        window.clearTimeout(profileHoverTimeoutRef.current);
      }
    };
  }, []);

  const scheduleProfileCard = () => {
    if (!isOtherMessage) {
      return;
    }

    if (profileHoverTimeoutRef.current) {
      window.clearTimeout(profileHoverTimeoutRef.current);
    }

    profileHoverTimeoutRef.current = window.setTimeout(() => {
      setShowProfileCard(true);
    }, 500);
  };

  const hideProfileCard = () => {
    if (profileHoverTimeoutRef.current) {
      window.clearTimeout(profileHoverTimeoutRef.current);
      profileHoverTimeoutRef.current = null;
    }

    setShowProfileCard(false);
  };

  return (
    <div
      ref={bubbleRef}
      className={`group flex items-end gap-2 ${message.sender === "me" ? "justify-end" : "justify-start"}`}
      onMouseLeave={() => {
        setShowReactionPicker(false);
        hideProfileCard();
      }}
    >
      {isOtherMessage ? (
        <div
          className="relative shrink-0"
          onMouseEnter={scheduleProfileCard}
          onMouseLeave={hideProfileCard}
        >
          <button
            type="button"
            className="rounded-full"
            aria-label={`View ${senderDisplayName} profile card`}
          >
            <MessageAvatar
              name={senderDisplayName}
              sizeClass="h-9 w-9"
              textClass="text-xs"
            />
          </button>

          {showProfileCard ? (
            <div onMouseEnter={scheduleProfileCard} onMouseLeave={hideProfileCard}>
              <MessageUserHoverCard
                name={senderDisplayName}
                username={message.senderUsername}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`relative max-w-[78%] ${renderedReactionBadges.length > 0 ? "pb-5" : ""}`}>
        <div
          className={`pointer-events-none absolute top-1/2 z-20 hidden -translate-y-1/2 items-center gap-2 transition md:flex ${railPositionClass} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`}
        >
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="relative">
              {canInteract ? (
                <button
                  type="button"
                  onClick={() => setShowReactionPicker((current) => !current)}
                  className={surfaceActionClass}
                  aria-label="React to message"
                >
                  {showReactionPicker ? <X className="h-3.5 w-3.5" /> : <SmilePlus className="h-3.5 w-3.5" />}
                </button>
              ) : null}

              {showReactionPicker && canInteract ? (
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
                          onToggleReaction?.(message.numericId, emoji, hasReacted);
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

            {canInteract && onReply ? (
              <button type="button" onClick={() => onReply(message.numericId)} className={surfaceActionClass} aria-label="Reply to message">
                <CornerUpLeft className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {canInteract && onForward ? (
              <button type="button" onClick={() => onForward(message.numericId)} className={surfaceActionClass} aria-label="Forward message">
                <Send className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {canInteract && message.canEdit && onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(message.numericId, message.body)}
                className={surfaceActionClass}
                aria-label="Edit message"
              >
                <PencilLine className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {canInteract && onRemove ? (
              <button type="button" onClick={() => onRemove(message.numericId)} className={surfaceActionClass} aria-label="Remove message">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          {message.isForwarded ? (
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-[0_8px_18px_rgba(96,109,160,0.12)] ${
                message.sender === "me"
                  ? "border-white/18 bg-[rgba(23,28,54,0.28)] text-white"
                  : "border-[rgba(96,91,255,0.12)] bg-[rgba(96,91,255,0.1)] text-[var(--accent)]"
              }`}
            >
              <Forward className="h-3 w-3" />
              <span>Forwarded</span>
            </div>
          ) : null}

          {message.quote ? (
            <div className="relative pb-1">
              <div
                className={`max-w-[88%] overflow-hidden rounded-[20px] px-3 py-2 shadow-[0_10px_24px_rgba(96,109,160,0.08)] ${replyQuoteBubbleClass} ${
                  message.sender === "me" ? "mr-auto" : "ml-auto"
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-medium ${
                    message.sender === "me" ? "text-white/88" : "text-[#5e6790]"
                  }`}
                >
                  <CornerUpLeft className="h-3 w-3" />
                  <span>{replyLabel}</span>
                </div>
                <div
                  className={`mt-1 rounded-[16px] px-3 py-2 text-[13px] leading-snug ${
                    message.sender === "me" ? "bg-[rgba(255,255,255,0.14)] text-white" : "bg-white text-[#475073]"
                  }`}
                >
                  <p className="line-clamp-2">{message.quote.text}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`rounded-[26px] px-4 py-3 text-sm leading-5 shadow-[0_14px_36px_rgba(96,109,160,0.06)] ${
              isImageOnlyMessage
                ? "bg-transparent px-0 py-0 shadow-none"
                : message.quote
                  ? replyBodyBubbleClass
                  : baseBubbleClass
            } ${message.quote ? "-mt-6 relative z-10 max-w-[72%]" : ""}`}
          >
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

            {!isImageOnlyMessage && !isFileOnlyMessage ? (
              message.quote ? <p className="break-words text-[14px] leading-snug">{message.body}</p> : <p className="leading-5">{message.body}</p>
            ) : null}

            {imageAttachments.length > 0 ? (
              <div className={`${isImageOnlyMessage ? "" : "mt-3"} space-y-2`}>
                {imageAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className={`block overflow-hidden rounded-[22px] ${
                      attachment.isExpired
                        ? message.sender === "me"
                          ? "border border-white/20 bg-white/10"
                          : "border border-[var(--line)] bg-[var(--accent-soft)]"
                        : ""
                    }`}
                  >
                    {attachment.isExpired || !attachment.downloadUrl ? (
                      <div
                        className={`px-3 py-3 text-xs ${
                          message.sender === "me" ? "text-white/75" : "text-[var(--muted)]"
                        }`}
                      >
                        {attachment.placeholderText ?? "Image expired / removed by storage policy"}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenImage?.(attachment.id)}
                        className="block w-full"
                        aria-label={`Open ${attachment.name}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={attachment.downloadUrl}
                          alt={attachment.name}
                          onLoad={onMediaLoad}
                          onError={onMediaLoad}
                          className="max-h-[320px] w-full rounded-[22px] object-cover shadow-[0_14px_36px_rgba(96,109,160,0.12)]"
                          loading="lazy"
                        />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {fileAttachments.length > 0 ? (
              <div className={`${isFileOnlyMessage ? "" : "mt-3"} space-y-2`}>
                {fileAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className={`block rounded-xl border px-3 py-2 text-xs ${
                      message.sender === "me"
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-[var(--line)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          message.sender === "me" ? "bg-white/12 text-white" : "bg-white text-[var(--accent)]"
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{attachment.name}</p>
                        <p className={message.sender === "me" ? "text-white/75" : "text-[var(--muted)]"}>
                          {attachment.isExpired
                            ? attachment.placeholderText ?? "File expired / removed by storage policy"
                            : `${Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB`}
                        </p>
                      </div>
                      {!attachment.isExpired && attachment.downloadUrl ? (
                        <a
                          href={attachment.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={attachment.name}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            message.sender === "me"
                              ? "bg-white/12 text-white hover:bg-white/18"
                              : "bg-white text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                          } transition`}
                          aria-label={`Download ${attachment.name}`}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <p
              className={`mt-1 text-[11px] leading-none ${
                isImageOnlyMessage
                  ? message.sender === "me"
                    ? "text-right text-[var(--muted)]"
                    : "text-left text-[var(--muted)]"
                  : message.sender === "me"
                    ? "text-white/75"
                    : "text-[var(--muted)]"
              }`}
            >
              {message.time}
              {message.isEdited ? " · Edited" : ""}
              {message.sender === "me" && readLabel ? ` · ${readLabel}` : ""}
            </p>
          </div>
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

export const MessageBubble = memo(MessageBubbleComponent, (prev, next) =>
  prev.message === next.message &&
  prev.authUserId === next.authUserId &&
  prev.canInteract === next.canInteract &&
  prev.readLabel === next.readLabel &&
  prev.isReacting === next.isReacting &&
  prev.onToggleReaction === next.onToggleReaction &&
  prev.onOpenImage === next.onOpenImage &&
  prev.onMediaLoad === next.onMediaLoad &&
  prev.onReply === next.onReply &&
  prev.onEdit === next.onEdit &&
  prev.onForward === next.onForward &&
  prev.onRemove === next.onRemove,
);
