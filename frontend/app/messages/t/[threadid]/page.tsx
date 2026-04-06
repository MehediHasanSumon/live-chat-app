import { notFound } from "next/navigation";

import { MessagesThreadLayout } from "@/components/messages/messages-thread-layout";
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

  return <MessagesThreadLayout thread={thread} />;
}
