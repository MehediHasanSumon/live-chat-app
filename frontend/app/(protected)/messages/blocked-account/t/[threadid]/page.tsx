import { MessagesThreadPage } from "@/components/messages/messages-thread-page";

type BlockedThreadPageProps = {
  params: Promise<{
    threadid: string;
  }>;
};

export default async function BlockedThreadPage({ params }: BlockedThreadPageProps) {
  const { threadid } = await params;

  return <MessagesThreadPage threadId={threadid} sidebarView="blocked" />;
}
