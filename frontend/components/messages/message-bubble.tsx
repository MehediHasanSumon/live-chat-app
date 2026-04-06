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
        <p>{message.body}</p>
        <p className={`mt-1 text-[11px] ${message.sender === "me" ? "text-white/75" : "text-[var(--muted)]"}`}>
          {message.time}
        </p>
      </div>
    </div>
  );
}
