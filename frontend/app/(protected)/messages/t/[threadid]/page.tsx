import { MessagesThreadPage } from "@/components/messages/messages-thread-page";

type ThreadPageProps = {
  params: Promise<{
    threadid: string;
  }>;
};

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { threadid } = await params;

  return <MessagesThreadPage threadId={threadid} />;
}
