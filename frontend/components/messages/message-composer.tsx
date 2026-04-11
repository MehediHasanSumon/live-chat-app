"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ImageIcon, Paperclip, SendHorizonal, Smile } from "lucide-react";

import { MessageComposerEmojiPicker } from "@/components/messages/message-composer-emoji-picker";
import { MessageComposerPreview } from "@/components/messages/message-composer-preview";
import { type ComposerAttachmentInput } from "@/lib/messages-data";
import { useStartTypingMutation, useStopTypingMutation } from "@/lib/hooks/use-typing-mutation";

type MessageComposerProps = {
  threadName: string;
  conversationId: string;
  isEditing?: boolean;
  editingValue?: string;
  editingMessagePreview?: string | null;
  replyPreview?: {
    senderName?: string;
    text: string;
  } | null;
  onEditingValueChange?: (value: string) => void;
  onCancelEditing?: () => void;
  onCancelReply?: () => void;
  onSend: (payload: {
    text: string;
    attachments: ComposerAttachmentInput[];
    voice: null;
    gif: null;
  }) => Promise<void>;
  isSending?: boolean;
  errorMessage?: string | null;
};

export function MessageComposer({
  threadName,
  conversationId,
  isEditing = false,
  editingValue = "",
  editingMessagePreview = null,
  replyPreview = null,
  onEditingValueChange,
  onCancelEditing,
  onCancelReply,
  onSend,
  isSending = false,
  errorMessage,
}: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachmentInput[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<ComposerAttachmentInput[]>([]);
  const stopTypingRef = useRef<() => void>(() => {});
  const typingTimerRef = useRef<number | null>(null);
  const isTypingActiveRef = useRef(false);
  const lastTypingPingAtRef = useRef(0);
  const startTypingMutation = useStartTypingMutation();
  const stopTypingMutation = useStopTypingMutation();
  void threadName;

  const isReplying = Boolean(replyPreview);
  const composerValue = isEditing ? editingValue : value;
  const isComposerLocked = isEditing && isSending;
  const hasText = composerValue.trim().length > 0;
  const hasMessagePayload = hasText || attachments.length > 0;

  const resizeTextarea = (ta: HTMLTextAreaElement) => {
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (!isTypingActiveRef.current) {
      return;
    }

    isTypingActiveRef.current = false;
    stopTypingMutation.mutate({ conversationId });
  }, [conversationId, stopTypingMutation]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    stopTypingRef.current = stopTyping;
  }, [stopTyping]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });

      stopTypingRef.current();
    };
  }, []);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        resizeTextarea(textareaRef.current);
      }
    });
  }, [isEditing, editingValue]);

  useEffect(() => {
    if (!showEmojiPicker) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!composerRef.current?.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showEmojiPicker]);

  const handleInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;

    if (isEditing) {
      onEditingValueChange?.(nextValue);
    } else {
      setValue(nextValue);
    }

    resizeTextarea(event.target);

    if (!nextValue.trim()) {
      stopTyping();
      return;
    }

    const now = Date.now();
    const shouldSendTypingPing =
      !isTypingActiveRef.current || now - lastTypingPingAtRef.current > 1500;

    if (shouldSendTypingPing) {
      isTypingActiveRef.current = true;
      lastTypingPingAtRef.current = now;
      startTypingMutation.mutate({ conversationId });
    }

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = window.setTimeout(() => {
      stopTyping();
    }, 1800);
  };

  const addFiles = (
    files: FileList | null,
    kind: "image" | "file",
    input?: HTMLInputElement | null,
  ) => {
    if (!files?.length || isComposerLocked || isEditing || isReplying) {
      return;
    }

    const nextItems = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      kind: file.type.startsWith("image/") ? "image" : kind,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    } satisfies ComposerAttachmentInput));

    setAttachments((current) => [...current, ...nextItems].slice(0, 6));

    if (input) {
      input.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const target = current.find((item) => item.id === id);

      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  };

  const appendEmoji = (emoji: string) => {
    const nextValue = `${composerValue}${emoji}`;

    if (isEditing) {
      onEditingValueChange?.(nextValue);
    } else {
      setValue(nextValue);
    }

    const now = Date.now();
    const shouldSendTypingPing =
      nextValue.trim().length > 0 && (!isTypingActiveRef.current || now - lastTypingPingAtRef.current > 1500);

    if (shouldSendTypingPing) {
      isTypingActiveRef.current = true;
      lastTypingPingAtRef.current = now;
      startTypingMutation.mutate({ conversationId });
    }

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = window.setTimeout(() => {
      stopTyping();
    }, 1800);

    setShowEmojiPicker(false);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        resizeTextarea(textareaRef.current);
      }
    });
  };

  const clearComposer = (options?: { revokePreviews?: boolean }) => {
    const revokePreviews = options?.revokePreviews ?? true;

    setValue("");
    setAttachments((current) => {
      current.forEach((item) => {
        if (revokePreviews && item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });

      return [];
    });
    setShowEmojiPicker(false);
    stopTyping();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSend = async () => {
    if (!hasMessagePayload || isComposerLocked) {
      return;
    }

    stopTyping();

    const payload = {
      text: composerValue,
      attachments: isReplying ? [] : [...attachments],
      voice: null,
      gif: null,
    } as const;

    if (!isEditing) {
      clearComposer({ revokePreviews: false });
    }

    try {
      await onSend(payload);

      if (isEditing) {
        clearComposer();
      } else {
        payload.attachments.forEach((item) => {
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
          }
        });
      }
    } catch (error) {
      if (!isEditing) {
        setValue(payload.text);
        setAttachments(payload.attachments);

        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            resizeTextarea(textareaRef.current);
          }
        });
      }

      throw error;
    }
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await handleSend();
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={composerRef}
        className="rounded-[22px] border border-[rgba(111,123,176,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,248,255,0.98)_100%)] p-2 shadow-[0_18px_40px_rgba(96,109,160,0.08)] transition-shadow duration-200 ease-out hover:shadow-[0_20px_46px_rgba(96,109,160,0.1)]"
      >
        {isEditing ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-[rgba(96,91,255,0.14)] bg-[rgba(96,91,255,0.06)] px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Editing message</p>
              <p className="mt-1 line-clamp-1 text-sm text-[#5a6388]">{editingMessagePreview ?? editingValue}</p>
            </div>
            <button
              type="button"
              onClick={onCancelEditing}
              className="rounded-full border border-[rgba(111,123,176,0.12)] px-3 py-1 text-xs font-medium text-[#5a6388] transition hover:border-[rgba(96,91,255,0.16)] hover:text-[var(--accent)]"
            >
              Cancel
            </button>
          </div>
        ) : replyPreview ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-[rgba(111,123,176,0.12)] bg-white/80 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#5a6388]">
                Replying {replyPreview.senderName ? `to ${replyPreview.senderName}` : "to message"}
              </p>
              <p className="mt-1 line-clamp-1 text-sm text-[#8f97bb]">{replyPreview.text}</p>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="rounded-full border border-[rgba(111,123,176,0.12)] px-3 py-1 text-xs font-medium text-[#5a6388] transition hover:border-[rgba(96,91,255,0.16)] hover:text-[var(--accent)]"
            >
              Cancel
            </button>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => addFiles(event.target.files, "file", event.currentTarget)}
        />
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(event) => addFiles(event.target.files, "image", event.currentTarget)}
        />

        {attachments.length > 0 ? (
          <MessageComposerPreview
            attachments={attachments}
            onRemove={removeAttachment}
          />
        ) : null}

        <div className="relative rounded-[18px] bg-white/88 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_8px_22px_rgba(96,109,160,0.05)] transition-all duration-200 ease-out">
          <textarea
            ref={textareaRef}
            value={composerValue}
            onChange={handleInput}
            onKeyDown={(event) => {
              void handleKeyDown(event);
            }}
            placeholder="Write a message..."
            rows={1}
            disabled={isComposerLocked}
            className="min-h-[36px] w-full resize-none border-none bg-transparent py-1.5 pr-12 text-[14px] leading-6 text-[#3b4260] outline-none ring-0 transition-[height] duration-200 ease-out focus:border-none focus:outline-none focus:ring-0 placeholder:text-[#a2aacd] disabled:cursor-not-allowed disabled:opacity-70"
            style={{ boxShadow: "none" }}
          />

          <MessageComposerEmojiPicker
            open={showEmojiPicker}
            onSelect={appendEmoji}
          />

          <button
            type="button"
            onClick={() => {
              if (!hasText && attachments.length === 0) {
                return;
              }

              void handleSend();
            }}
            aria-label={isEditing ? "Save message" : "Send message"}
            disabled={isComposerLocked}
            className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-[13px] bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] text-white shadow-[0_12px_24px_rgba(96,91,255,0.24)] transition-all duration-200 ease-out hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SendHorizonal className="h-3.5 w-3.5" />
          </button>
        </div>

        {errorMessage ? (
          <p className="px-2.5 pt-2 text-[12px] text-rose-500">{errorMessage}</p>
        ) : null}

        <div className="flex items-center justify-between px-2.5 pt-1.5">
          <div className="flex gap-1">
            <button
              aria-label="Attach file"
              onClick={() => fileInputRef.current?.click()}
              disabled={isComposerLocked || isEditing || isReplying}
              className="rounded-lg p-1.5 text-[#b0b7d3] transition-all duration-200 ease-out hover:bg-[rgba(96,91,255,0.06)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Upload image"
              onClick={() => imageInputRef.current?.click()}
              disabled={isComposerLocked || isEditing || isReplying}
              className="rounded-lg p-1.5 text-[#b0b7d3] transition-all duration-200 ease-out hover:bg-[rgba(96,91,255,0.06)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Emoji"
              onClick={() => setShowEmojiPicker((current) => !current)}
              disabled={isComposerLocked}
              className="rounded-lg p-1.5 text-[#b0b7d3] transition-all duration-200 ease-out hover:bg-[rgba(96,91,255,0.06)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
          </div>
          {composerValue.length > 60 ? (
            <span className="text-[11px] text-[#b0b7d3] transition-opacity duration-200">
              {composerValue.length}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
