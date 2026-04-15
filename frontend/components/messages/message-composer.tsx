"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ImageIcon, Mic, Paperclip, SendHorizonal, Smile, Square, X } from "lucide-react";

import { MessageComposerEmojiPicker } from "@/components/messages/message-composer-emoji-picker";
import { MessageComposerPreview } from "@/components/messages/message-composer-preview";
import { type ComposerAttachmentInput, type ComposerVoiceInput } from "@/lib/messages-data";
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
    voice: ComposerVoiceInput | null;
    gif: null;
  }) => Promise<void>;
  isSending?: boolean;
  errorMessage?: string | null;
};

function MessageComposerComponent({
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
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
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
  const shouldShowSendButton = isEditing || hasMessagePayload;
  const canRecordVoice = !isEditing && !isReplying && !isComposerLocked && !isSending && attachments.length === 0 && !hasText;

  const resizeTextarea = (ta: HTMLTextAreaElement) => {
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const stopRecordingStream = useCallback(() => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }, []);

  const resetRecordingState = useCallback(() => {
    clearRecordingTimer();
    stopRecordingStream();
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    recordingStartedAtRef.current = 0;
    setIsRecordingVoice(false);
    setRecordingMs(0);
  }, [clearRecordingTimer, stopRecordingStream]);

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
      resetRecordingState();
    };
  }, [resetRecordingState]);

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

  const getVoiceMimeType = () => {
    if (typeof MediaRecorder === "undefined") {
      return "";
    }

    return [
      "audio/webm",
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
  };

  const getVoiceExtension = (mimeType: string) => {
    if (mimeType.includes("ogg")) {
      return "ogg";
    }

    if (mimeType.includes("mp4")) {
      return "m4a";
    }

    return "webm";
  };

  const formatRecordingTime = (durationMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const startVoiceRecording = async () => {
    if (!canRecordVoice || isRecordingVoice) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      setRecordingError(null);
      stopTyping();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getVoiceMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.start();
      setIsRecordingVoice(true);
      setRecordingMs(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingMs(Date.now() - recordingStartedAtRef.current);
      }, 250);
    } catch {
      resetRecordingState();
      setRecordingError("Microphone permission is needed to send a voice clip.");
    }
  };

  const stopVoiceRecording = (shouldSend: boolean) => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      resetRecordingState();
      return;
    }

    const startedAt = recordingStartedAtRef.current;
    const mimeType = recorder.mimeType || getVoiceMimeType() || "audio/webm";

    recorder.onstop = () => {
      const chunks = [...recordingChunksRef.current];
      const durationMs = Math.max(1, Date.now() - startedAt);
      resetRecordingState();

      if (!shouldSend || chunks.length === 0 || durationMs < 300) {
        return;
      }

      const blob = new Blob(chunks, { type: mimeType });
      const file = new File([blob], `voice-${Date.now()}.${getVoiceExtension(mimeType)}`, {
        type: mimeType,
      });

      void onSend({
        text: "",
        attachments: [],
        voice: {
          id: crypto.randomUUID(),
          file,
          durationMs,
        },
        gif: null,
      }).catch(() => undefined);
    };

    clearRecordingTimer();
    recorder.stop();
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

        {isRecordingVoice ? (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(96,91,255,0.14)] bg-white/82 px-3 py-2 text-[#4b5274]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" />
              <span className="text-sm font-semibold tabular-nums">{formatRecordingTime(recordingMs)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => stopVoiceRecording(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(111,123,176,0.14)] bg-white text-[#8a92b3] transition hover:text-rose-500"
                aria-label="Cancel voice recording"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => stopVoiceRecording(true)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-[0_10px_20px_rgba(96,91,255,0.22)] transition hover:brightness-105"
                aria-label="Send voice recording"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            </div>
          </div>
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
            disabled={isComposerLocked || isRecordingVoice}
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
              if (!shouldShowSendButton) {
                void startVoiceRecording();
                return;
              }

              void handleSend();
            }}
            aria-label={shouldShowSendButton ? (isEditing ? "Save message" : "Send message") : "Record voice clip"}
            disabled={isComposerLocked || isRecordingVoice || isSending || (!shouldShowSendButton && !canRecordVoice)}
            className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-[13px] bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] text-white shadow-[0_12px_24px_rgba(96,91,255,0.24)] transition-all duration-200 ease-out hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {shouldShowSendButton ? <SendHorizonal className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
        </div>

        {errorMessage || recordingError ? (
          <p className="px-2.5 pt-2 text-[12px] text-rose-500">{recordingError ?? errorMessage}</p>
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

export const MessageComposer = memo(MessageComposerComponent, (prev, next) =>
  prev.threadName === next.threadName &&
  prev.conversationId === next.conversationId &&
  prev.isEditing === next.isEditing &&
  prev.editingValue === next.editingValue &&
  prev.editingMessagePreview === next.editingMessagePreview &&
  prev.replyPreview === next.replyPreview &&
  prev.onEditingValueChange === next.onEditingValueChange &&
  prev.onCancelEditing === next.onCancelEditing &&
  prev.onCancelReply === next.onCancelReply &&
  prev.onSend === next.onSend &&
  prev.isSending === next.isSending &&
  prev.errorMessage === next.errorMessage,
);
