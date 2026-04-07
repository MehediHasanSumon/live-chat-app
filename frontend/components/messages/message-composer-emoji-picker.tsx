"use client";

type MessageComposerEmojiPickerProps = {
  open: boolean;
  onSelect: (emoji: string) => void;
};

const EMOJIS = ["😀", "😂", "😍", "👍", "🔥", "🎉", "❤️", "🙏"];

export function MessageComposerEmojiPicker({
  open,
  onSelect,
}: MessageComposerEmojiPickerProps) {
  return (
    <div
      className={`absolute bottom-14 left-2 z-10 flex gap-1 rounded-2xl border border-[rgba(111,123,176,0.12)] bg-white p-2 shadow-[0_14px_30px_rgba(96,109,160,0.14)] transition-all duration-200 ease-out ${
        open
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="rounded-lg p-1 text-lg transition hover:bg-[rgba(96,91,255,0.06)]"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
