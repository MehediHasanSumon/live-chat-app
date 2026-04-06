import { Paperclip, SendHorizontal } from "lucide-react";

export function MessageComposer() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-3 py-2">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      <input
        type="text"
        placeholder="Write a message"
        className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
      />
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white transition hover:bg-[var(--accent-strong)]"
      >
        <SendHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}
