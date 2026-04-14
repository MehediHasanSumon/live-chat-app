import { MessagesThreadPage } from "@/components/messages/messages-thread-page";

type RequestThreadPageProps = {
  params: Promise<{
    threadid: string;
  }>;
};

export default async function RequestThreadPage({ params }: RequestThreadPageProps) {
  const { threadid } = await params;

  return <MessagesThreadPage threadId={threadid} sidebarView="requests" />;
}
