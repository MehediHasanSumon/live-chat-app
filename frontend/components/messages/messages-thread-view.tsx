"use client";

import { ApiClientError } from "@/lib/api-client";
import { useStartCallMutation, useJoinCallMutation } from "@/lib/hooks/use-call-mutations";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useConversationMessagesQuery } from "@/lib/hooks/use-conversation-messages-query";
import { useSendMessageMutation, useToggleReactionMutation } from "@/lib/hooks/use-message-mutations";
import { toChatMessage, type MessageThread } from "@/lib/messages-data";
import { useCallStore } from "@/lib/stores/call-store";
import { useConversationRealtimeStore } from "@/lib/stores/conversation-realtime-store";
import { MessagesChatHeader } from "@/components/messages/messages-chat-header";
import { MessageBubble } from "@/components/messages/message-bubble";
import { MessageComposer } from "@/components/messages/message-composer";

type MessagesThreadViewProps = {
  thread: MessageThread;
  isInfoSidebarOpen: boolean;
  onToggleInfoSidebar: () => void;
};

export function MessagesThreadView({
  thread,
  isInfoSidebarOpen,
  onToggleInfoSidebar,
}: MessagesThreadViewProps) {
  const { data: authMe } = useAuthMeQuery(true);
  const { data: messages = [], isLoading, isError } = useConversationMessagesQuery(thread.id);
  const sendMessageMutation = useSendMessageMutation();
  const toggleReactionMutation = useToggleReactionMutation(thread.id);
  const startCallMutation = useStartCallMutation();
  const joinCallMutation = useJoinCallMutation();
  const activeCall = useCallStore((state) => state.activeCall);
  const typingUsers = useConversationRealtimeStore((state) => state.typingUsersByConversation[thread.id] ?? []);

  const mappedMessages = messages.map((message) => toChatMessage(message, authMe?.data.user.id));

  const composerErrorMessage =
    sendMessageMutation.error instanceof ApiClientError
      ? sendMessageMutation.error.errors?.file?.[0] ??
        sendMessageMutation.error.errors?.text?.[0] ??
        sendMessageMutation.error.errors?.message_id?.[0] ??
        sendMessageMutation.error.message
      : sendMessageMutation.error
        ? "We could not send the message."
        : null;

  const currentCallForThread =
    activeCall?.callRoom.conversation_id === thread.numericId ? activeCall : null;

  const handleStartCall = async (mediaType: "voice" | "video") => {
    if (!authMe?.data.user.id) {
      return;
    }

    const callRoom = await startCallMutation.mutateAsync({
      thread,
      mediaType,
      authUserId: authMe.data.user.id,
    });

    await joinCallMutation.mutateAsync({
      roomUuid: callRoom.room_uuid,
      wantsVideo: mediaType === "video",
    });
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-white/60">
      <MessagesChatHeader
        thread={thread}
        isInfoSidebarOpen={isInfoSidebarOpen}
        onToggleInfoSidebar={onToggleInfoSidebar}
        onStartVoiceCall={() => {
          void handleStartCall("voice");
        }}
        onStartVideoCall={() => {
          void handleStartCall("video");
        }}
        isStartingVoiceCall={startCallMutation.isPending && startCallMutation.variables?.mediaType === "voice"}
        isStartingVideoCall={startCallMutation.isPending && startCallMutation.variables?.mediaType === "video"}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {typingUsers.length > 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-sm text-[var(--muted)]">
            {typingUsers.map((user) => user.name).join(", ")} {typingUsers.length > 1 ? "are" : "is"} typing...
          </div>
        ) : null}

        {currentCallForThread ? (
          <div className="rounded-2xl border border-[rgba(96,91,255,0.14)] bg-[rgba(96,91,255,0.06)] px-4 py-3 text-sm text-[#575f86]">
            {currentCallForThread.token ? (
              <span>
                Call session ready in <span className="font-medium text-[#2f3655]">{currentCallForThread.publishMode}</span> mode.
              </span>
            ) : (
              <span>
                {currentCallForThread.callRoom.media_type === "video" ? "Video" : "Voice"} call is{" "}
                <span className="font-medium text-[#2f3655]">{currentCallForThread.callRoom.status}</span>.
              </span>
            )}
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`message-skeleton-${index}`}
                className="h-16 animate-pulse rounded-2xl border border-[var(--line)] bg-white/70"
              />
            ))}
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            We could not load this conversation timeline.
          </div>
        ) : null}

        {!isLoading && !isError && mappedMessages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/70 px-4 py-6 text-sm text-[var(--muted)]">
            No messages yet. Start the conversation below.
          </div>
        ) : null}

        {mappedMessages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            authUserId={authMe?.data.user.id ?? null}
            onToggleReaction={(emoji, hasReacted) => {
              void toggleReactionMutation.mutateAsync({
                messageId: message.numericId,
                emoji,
                hasReacted,
              });
            }}
            isReacting={toggleReactionMutation.isPending}
          />
        ))}
      </div>

      <footer className="px-4 py-4 sm:px-6">
        <MessageComposer
          threadName={thread.name}
          conversationId={thread.id}
          isSending={sendMessageMutation.isPending}
          errorMessage={composerErrorMessage}
          onSend={async ({ text, attachments, voice, gif }) => {
            await sendMessageMutation.mutateAsync({
              conversationId: thread.id,
              text,
              attachments,
              voice,
              gif,
            });
          }}
        />
      </footer>
    </section>
  );
}
