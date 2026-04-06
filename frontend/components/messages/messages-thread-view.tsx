import { MoreVertical, Paperclip, Phone, SendHorizontal, Video } from "lucide-react";

import { threadMessages, type MessageThread } from "@/lib/messages-data";

type MessagesThreadViewProps = {
  thread: MessageThread;
};

export function MessagesThreadView({ thread }: MessagesThreadViewProps) {
  const messages = threadMessages[thread.id] ?? [];

  return (
    <section className="flex min-h-[70vh] flex-col bg-white/60">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
            {thread.name.slice(0, 1)}
            {thread.online ? (
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            ) : null}
          </div>
          <div>
            <p className="text-sm font-semibold sm:text-base">{thread.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[var(--muted)]">
          {[Phone, Video, MoreVertical].map((Icon, index) => (
            <button
              key={index}
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white transition hover:border-[rgba(96,91,255,0.28)] hover:text-[var(--accent)]"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-4 px-4 py-5 sm:px-6">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                message.sender === "me"
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--line)] bg-white text-[var(--foreground)]"
              }`}
            >
              <p>{message.body}</p>
              <p className={`mt-1 text-[11px] ${message.sender === "me" ? "text-white/75" : "text-[var(--muted)]"}`}>
                {message.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <footer className="border-t border-[var(--line)] px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-3 py-2">
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]">
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            type="text"
            placeholder="Write a message"
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
          />
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white transition hover:bg-[var(--accent-strong)]">
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </section>
  );
}
