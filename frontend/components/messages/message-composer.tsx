"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ImageIcon, Mic, Paperclip, SendHorizonal, Smile } from "lucide-react";

import { MessageComposerPreview } from "@/components/messages/message-composer-preview";
import { MessageComposerEmojiPicker } from "@/components/messages/message-composer-emoji-picker";
import { type ComposerAttachmentInput } from "@/lib/messages-data";

type MessageComposerProps = {
  threadName: string;
  onSend: (payload: { text: string; attachments: ComposerAttachmentInput[] }) => Promise<void>;
  isSending?: boolean;
  errorMessage?: string | null;
};

export function MessageComposer({
  threadName,
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
  const hasText = value.trim().length > 0;
  void threadName;

  useEffect(() => {
    return () => {
      attachments.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [attachments]);

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

  const resizeTextarea = (ta: HTMLTextAreaElement) => {
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  };

  const handleInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    resizeTextarea(event.target);
  };

  const addFiles = (
    files: FileList | null,
    kind: "image" | "file",
    input?: HTMLInputElement | null,
  ) => {
    if (!files?.length || isSending) {
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
    const next = `${value}${emoji}`;
    setValue(next);
    setShowEmojiPicker(false);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        resizeTextarea(textareaRef.current);
      }
    });
  };

  const clearComposer = () => {
    setValue("");
    setAttachments((current) => {
      current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });

      return [];
    });
    setShowEmojiPicker(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSend = async () => {
    if ((!hasText && attachments.length === 0) || isSending) {
      return;
    }

    await onSend({
      text: value,
      attachments: [...attachments],
    });

    clearComposer();
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await handleSend();
    }
  };

  return (
    <div className="space-y-3">
      <div className="px-1">
        <div className="inline-flex items-center rounded-full bg-white/92 px-3 py-1.5 shadow-[0_8px_18px_rgba(96,109,160,0.06)] transition-all duration-200 ease-out">
          <p className="text-[12px] font-medium text-[#8f97bb]">
            Ready to message
          </p>
        </div>
      </div>

      <div
        ref={composerRef}
        className="rounded-[22px] border border-[rgba(111,123,176,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,248,255,0.98)_100%)] p-2 shadow-[0_18px_40px_rgba(96,109,160,0.08)] transition-shadow duration-200 ease-out hover:shadow-[0_20px_46px_rgba(96,109,160,0.1)]"
      >
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

        <div className="relative rounded-[18px] bg-white/88 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_8px_22px_rgba(96,109,160,0.05)] transition-all duration-200 ease-out">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={(event) => {
              void handleKeyDown(event);
            }}
            placeholder="Write a message..."
            rows={2}
            disabled={isSending}
            className="min-h-[44px] w-full resize-none border-none bg-transparent py-2 pr-14 text-[14px] leading-relaxed text-[#3b4260] outline-none ring-0 transition-[height] duration-200 ease-out focus:border-none focus:outline-none focus:ring-0 placeholder:text-[#a2aacd] disabled:cursor-not-allowed disabled:opacity-70"
            style={{ boxShadow: "none" }}
          />

          <MessageComposerEmojiPicker
            open={showEmojiPicker}
            onSelect={appendEmoji}
          />

          <button
            type="button"
            onClick={() => {
              void handleSend();
            }}
            aria-label={
              hasText || attachments.length > 0
                ? "Send message"
                : "Record voice message"
            }
            disabled={isSending}
            className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] text-white shadow-[0_12px_24px_rgba(96,91,255,0.24)] transition-all duration-200 ease-out hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {hasText || attachments.length > 0 ? (
              <SendHorizonal className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
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
              disabled={isSending}
              className="rounded-lg p-1.5 text-[#b0b7d3] transition-all duration-200 ease-out hover:bg-[rgba(96,91,255,0.06)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Upload image"
              onClick={() => imageInputRef.current?.click()}
              disabled={isSending}
              className="rounded-lg p-1.5 text-[#b0b7d3] transition-all duration-200 ease-out hover:bg-[rgba(96,91,255,0.06)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Emoji"
              onClick={() => setShowEmojiPicker((current) => !current)}
              disabled={isSending}
              className="rounded-lg p-1.5 text-[#b0b7d3] transition-all duration-200 ease-out hover:bg-[rgba(96,91,255,0.06)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
          </div>
          {isSending ? (
            <span className="text-[11px] text-[#8f97bb]">Sending...</span>
          ) : value.length > 60 ? (
            <span className="text-[11px] text-[#b0b7d3] transition-opacity duration-200">
              {value.length}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
