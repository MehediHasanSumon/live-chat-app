import { MessagesThreadPage } from "@/components/messages/messages-thread-page";

type ArchivedThreadPageProps = {
  params: Promise<{
    threadid: string;
  }>;
};

export default async function ArchivedThreadPage({ params }: ArchivedThreadPageProps) {
  const { threadid } = await params;

  return <MessagesThreadPage threadId={threadid} sidebarView="archived" />;
}
