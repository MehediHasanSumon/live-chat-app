import { MessageSquareText } from "lucide-react";

export function MessagesEmptyState() {
  return (
    <section className="flex h-full w-full flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <MessageSquareText className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Select a conversation</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        Choose a conversation from the sidebar to open its details. The real message timeline lands in the next backend phase.
      </p>
    </section>
  );
}
