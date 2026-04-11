import { MessageSquareText } from "lucide-react";

type MessagesEmptyStateProps = {
  title?: string;
  description?: string;
};

export function MessagesEmptyState({
  title = "Select a conversation",
  description = "Choose a conversation from the sidebar to open its details. The real message timeline lands in the next backend phase.",
}: MessagesEmptyStateProps) {
  return (
    <section className="flex h-full w-full flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <MessageSquareText className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </section>
  );
}
