import { MessagesEmptyState } from "@/components/messages/messages-empty-state";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";

export default function MessagesPage() {
  return <MessagesShell sidebar={<MessagesSidebar />} content={<MessagesEmptyState />} />;
}
