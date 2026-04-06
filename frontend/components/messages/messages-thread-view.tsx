import { threadMessages, type MessageThread } from "@/lib/messages-data";
import { MessagesChatHeader } from "@/components/messages/messages-chat-header";
import { MessageBubble } from "@/components/messages/message-bubble";
import { MessageComposer } from "@/components/messages/message-composer";

type MessagesThreadViewProps = {
  thread: MessageThread;
};

export function MessagesThreadView({ thread }: MessagesThreadViewProps) {
  const messages = threadMessages[thread.id] ?? [];

  return (
    <section className="flex min-h-[70vh] flex-col bg-white/60">
      <MessagesChatHeader thread={thread} />

      <div className="flex-1 space-y-4 px-4 py-5 sm:px-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      <footer className="border-t border-[var(--line)] px-4 py-4 sm:px-6">
        <MessageComposer />
      </footer>
    </section>
  );
}
