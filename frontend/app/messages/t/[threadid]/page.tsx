import { notFound } from "next/navigation";

import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";
import { MessagesThreadView } from "@/components/messages/messages-thread-view";
import { MessagesUserSidebar } from "@/components/messages/messages-user-sidebar";
import { messageThreads } from "@/lib/messages-data";

type ThreadPageProps = {
  params: Promise<{
    threadid: string;
  }>;
};

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { threadid } = await params;
  const thread = messageThreads.find((item) => item.id === threadid);

  if (!thread) {
    notFound();
  }

  return (
    <MessagesShell
      sidebar={<MessagesSidebar activeThreadId={threadid} />}
      content={<MessagesThreadView thread={thread} />}
      aside={<MessagesUserSidebar thread={thread} />}
    />
  );
}
