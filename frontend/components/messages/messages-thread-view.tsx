"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { MessagesChatHeader } from "@/components/messages/messages-chat-header";
import { MessageBubble } from "@/components/messages/message-bubble";
import { MessageComposer } from "@/components/messages/message-composer";
import { ApiClientError } from "@/lib/api-client";
import { useStartCallMutation, useJoinCallMutation } from "@/lib/hooks/use-call-mutations";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { useConversationMessagesQuery } from "@/lib/hooks/use-conversation-messages-query";
import { useMarkConversationReadMutation } from "@/lib/hooks/use-mark-read-mutation";
import {
  useDeleteMessageMutation,
  useEditMessageMutation,
  useForwardMessageMutation,
  useSendMessageMutation,
  useToggleReactionMutation,
} from "@/lib/hooks/use-message-mutations";
import { useTypingUsersQuery } from "@/lib/hooks/use-typing-users-query";
import { toChatMessage, toConversationThread, type MessageThread } from "@/lib/messages-data";
import { useCallStore } from "@/lib/stores/call-store";
import { useConversationRealtimeStore } from "@/lib/stores/conversation-realtime-store";

const EMPTY_TYPING_USERS: { id: number; name: string }[] = [];

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
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isRefetching,
  } = useConversationMessagesQuery(thread.id);
  const sendMessageMutation = useSendMessageMutation();
  const toggleReactionMutation = useToggleReactionMutation(thread.id);
  const editMessageMutation = useEditMessageMutation(thread.id);
  const deleteMessageMutation = useDeleteMessageMutation(thread.id);
  const forwardMessageMutation = useForwardMessageMutation(thread.id);
  const markReadMutation = useMarkConversationReadMutation();
  const startCallMutation = useStartCallMutation();
  const joinCallMutation = useJoinCallMutation();
  const { data: forwardConversations = [] } = useConversationsQuery(true);
  const activeCall = useCallStore((state) => state.activeCall);
  const realtimeTypingUsers = useConversationRealtimeStore(
    (state) => state.typingUsersByConversation[thread.id] ?? EMPTY_TYPING_USERS,
  );
  const { data: polledTypingUsers = [] } = useTypingUsersQuery(thread.id, true);
  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number | null>(null);
  const previousScrollTopRef = useRef<number>(0);
  const previousLatestSeqRef = useRef<number | null>(null);
  const hasInitialScrollRef = useRef(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [forwardingMessageId, setForwardingMessageId] = useState<number | null>(null);
  const [forwardingSearch, setForwardingSearch] = useState("");
  const [removeTargetMessageId, setRemoveTargetMessageId] = useState<number | null>(null);
  const [removeScope, setRemoveScope] = useState<"self" | "everyone">("self");

  const mappedMessages = useMemo(
    () => messages.map((message) => toChatMessage(message, authMe?.data.user.id)),
    [messages, authMe?.data.user.id],
  );
  const latestMessage = messages.at(-1) ?? null;
  const activeMembership = thread.membership ?? null;
  const peerMembership = thread.isGroup
    ? null
    : (thread.members ?? []).find((member) => member.user_id !== authMe?.data.user.id) ?? null;

  const activeComposerError = editingMessageId ? editMessageMutation.error : sendMessageMutation.error;
  const composerErrorMessage =
    activeComposerError instanceof ApiClientError
      ? activeComposerError.errors?.file?.[0] ??
        activeComposerError.errors?.text?.[0] ??
        activeComposerError.errors?.message_id?.[0] ??
        activeComposerError.message
      : activeComposerError
        ? editingMessageId
          ? "We could not update the message."
          : "We could not send the message."
        : null;

  const currentCallForThread =
    activeCall?.callRoom.conversation_id === thread.numericId ? activeCall : null;
  const typingUsers = polledTypingUsers.length > 0 ? polledTypingUsers : realtimeTypingUsers;
  const isTimelineRefreshing = isRefetching && !isFetchingNextPage;
  const removeTargetMessage = useMemo(
    () => mappedMessages.find((message) => message.numericId === removeTargetMessageId) ?? null,
    [mappedMessages, removeTargetMessageId],
  );
  const editingMessage = useMemo(
    () => mappedMessages.find((message) => message.numericId === editingMessageId) ?? null,
    [mappedMessages, editingMessageId],
  );
  const forwardTargets = useMemo(
    () => forwardConversations
      .filter((conversation) => String(conversation.id) !== thread.id)
      .map((conversation) => toConversationThread(conversation)),
    [forwardConversations, thread.id],
  );
  const filteredForwardTargets = useMemo(() => {
    const query = forwardingSearch.trim().toLowerCase();

    if (!query) {
      return forwardTargets;
    }

    return forwardTargets.filter((target) =>
      [target.name, target.handle, target.lastMessage]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [forwardTargets, forwardingSearch]);

  useEffect(() => {
    hasInitialScrollRef.current = false;
    previousLatestSeqRef.current = null;
    previousScrollHeightRef.current = null;
  }, [thread.id]);

  useEffect(() => {
    if (!latestMessage || !activeMembership || markReadMutation.isPending) {
      return;
    }

    if (latestMessage.seq <= activeMembership.last_read_seq) {
      return;
    }

    void markReadMutation.mutateAsync({
      conversationId: thread.id,
      lastSeq: latestMessage.seq,
    });
  }, [activeMembership, latestMessage, markReadMutation, thread.id]);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    if (previousScrollHeightRef.current !== null && !isFetchingNextPage) {
      const scrollDelta = container.scrollHeight - previousScrollHeightRef.current;
      container.scrollTop = previousScrollTopRef.current + scrollDelta;
      previousScrollHeightRef.current = null;
      return;
    }

    const latestSeq = latestMessage?.seq ?? null;

    if (!latestSeq) {
      return;
    }

    const shouldScrollToBottom =
      !hasInitialScrollRef.current ||
      (previousLatestSeqRef.current !== latestSeq &&
        container.scrollHeight - (container.scrollTop + container.clientHeight) < 180);

    previousLatestSeqRef.current = latestSeq;

    if (shouldScrollToBottom) {
      container.scrollTop = container.scrollHeight;
      hasInitialScrollRef.current = true;
    }
  }, [isFetchingNextPage, latestMessage?.seq, mappedMessages.length]);

  const handleLoadOlder = async () => {
    const container = scrollContainerRef.current;

    if (container) {
      previousScrollHeightRef.current = container.scrollHeight;
      previousScrollTopRef.current = container.scrollTop;
    }

    await fetchNextPage();
  };

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

  const startEditing = (messageId: number, currentBody: string) => {
    setEditingMessageId(messageId);
    setEditingValue(currentBody);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingValue("");
  };

  const handleSaveEdit = async (messageId: number) => {
    if (!editingValue.trim()) {
      return;
    }

    await editMessageMutation.mutateAsync({
      conversationId: thread.id,
      messageId,
      text: editingValue,
    });

    cancelEditing();
  };

  const handleRemove = async (messageId: number, scope: "self" | "everyone") => {
    await deleteMessageMutation.mutateAsync({
      conversationId: thread.id,
      messageId,
      scope,
    });

    setRemoveTargetMessageId(null);
    setRemoveScope("self");
  };

  const openRemoveModal = (messageId: number, preferredScope: "self" | "everyone" = "self") => {
    setRemoveTargetMessageId(messageId);
    setRemoveScope(preferredScope);
  };

  const handleForward = async (targetConversationId: string) => {
    if (!forwardingMessageId) {
      return;
    }

    await forwardMessageMutation.mutateAsync({
      sourceConversationId: thread.id,
      targetConversationId,
      messageId: forwardingMessageId,
    });

    setForwardingMessageId(null);
    setForwardingSearch("");
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

      <div
        ref={scrollContainerRef}
        className="flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.45)_0%,rgba(246,248,255,0.72)_100%)] px-4 py-5 sm:px-6"
      >
        <div className="-mx-1 flex justify-center pb-2 pt-1">
          {hasNextPage ? (
            <button
              type="button"
              onClick={() => {
                void handleLoadOlder();
              }}
              disabled={isFetchingNextPage}
              className="rounded-full border border-[rgba(111,123,176,0.16)] bg-white/90 px-4 py-2 text-xs font-semibold text-[#5a6388] shadow-[0_10px_24px_rgba(96,109,160,0.08)] transition hover:border-[rgba(96,91,255,0.18)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetchingNextPage ? "Loading older messages..." : "Load older messages"}
            </button>
          ) : mappedMessages.length > 0 ? (
            <div className="rounded-full border border-[rgba(111,123,176,0.12)] bg-white/80 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#99a1c2]">
              Conversation start
            </div>
          ) : null}
        </div>

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

        {isTimelineRefreshing ? (
          <div className="rounded-full border border-[rgba(111,123,176,0.12)] bg-white/80 px-3 py-1 text-center text-[11px] font-medium text-[#8d95bb]">
            Syncing latest messages...
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`message-skeleton-${index}`}
                className={`h-20 animate-pulse rounded-[26px] border border-[var(--line)] ${
                  index % 2 === 0 ? "mr-auto max-w-[72%]" : "ml-auto max-w-[58%]"
                } bg-white/70`}
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

        <div className="space-y-3 pb-2">
          {mappedMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              authUserId={authMe?.data.user.id ?? null}
              onEdit={() => startEditing(message.numericId, message.body)}
              onForward={() => setForwardingMessageId(message.numericId)}
              onRemove={() => openRemoveModal(message.numericId, "self")}
              readLabel={
                !thread.isGroup && message.sender === "me" && peerMembership
                  ? peerMembership.last_read_seq >= message.seq
                    ? "Seen"
                    : "Sent"
                  : null
              }
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

      </div>

      <footer className="space-y-2 px-4 py-4 sm:px-6">
        {typingUsers.length > 0 ? (
          <div className="inline-flex rounded-full border border-[rgba(96,91,255,0.16)] bg-[linear-gradient(135deg,rgba(96,91,255,0.12)_0%,rgba(122,117,255,0.18)_100%)] px-4 py-2 text-sm text-[#5a6388] shadow-[0_10px_24px_rgba(96,109,160,0.08)]">
            {typingUsers.map((user) => user.name).join(", ")} {typingUsers.length > 1 ? "are" : "is"} typing...
          </div>
        ) : null}

        <MessageComposer
          threadName={thread.name}
          conversationId={thread.id}
          isEditing={Boolean(editingMessage)}
          editingValue={editingValue}
          editingMessagePreview={editingMessage?.body ?? null}
          onEditingValueChange={setEditingValue}
          onCancelEditing={cancelEditing}
          isSending={sendMessageMutation.isPending || editMessageMutation.isPending}
          errorMessage={composerErrorMessage}
          onSend={async ({ text, attachments, voice, gif }) => {
            if (editingMessageId) {
              await handleSaveEdit(editingMessageId);
              return;
            }

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

      {forwardingMessageId ? (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center px-4 py-6"
          onClick={() => {
            setForwardingMessageId(null);
            setForwardingSearch("");
          }}
        >
          <div
            className="flex h-[min(480px,82vh)] w-full max-w-[440px] flex-col overflow-hidden rounded-[22px] border border-[rgba(111,123,176,0.14)] bg-white shadow-[0_18px_40px_rgba(61,72,120,0.1)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div className="w-8" />
              <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#2f3655]">Forward</h2>
              <button
                type="button"
                onClick={() => {
                  setForwardingMessageId(null);
                  setForwardingSearch("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(96,91,255,0.08)] bg-[var(--accent-soft)] text-[var(--accent)] transition hover:border-[rgba(96,91,255,0.18)] hover:bg-[rgba(96,91,255,0.16)]"
                aria-label="Close forward modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden px-4 py-4">
              <div className="pill-input relative flex h-10 items-center rounded-[16px] px-3 text-sm text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <Search className="pointer-events-none h-3.5 w-3.5 shrink-0 text-[#99a1c2]" />
                <input
                  type="text"
                  value={forwardingSearch}
                  onChange={(event) => setForwardingSearch(event.target.value)}
                  placeholder="Search for people and groups"
                  className="min-w-0 flex-1 bg-transparent pl-2.5 text-[13px] text-[#3a4160] outline-none placeholder:text-[#99a1c2]"
                />
              </div>

              <div className="mt-4">
                <p className="text-[14px] font-semibold text-[#2f3655]">Contacts</p>
              </div>

              <div className="mt-3 h-[calc(100%-4.5rem)] overflow-y-auto pr-1">
                <div className="space-y-1.5">
                  {filteredForwardTargets.length > 0 ? (
                    filteredForwardTargets.map((target) => (
                      <div
                        key={target.id}
                        className="flex items-center justify-between gap-2.5 rounded-[18px] border border-transparent bg-white/72 px-2.5 py-2.5 transition hover:border-[rgba(96,91,255,0.14)] hover:bg-white hover:shadow-[0_10px_24px_rgba(96,109,160,0.08)]"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,rgba(96,91,255,0.16)_0%,rgba(131,165,255,0.24)_100%)] text-[12px] font-semibold text-[var(--accent)]">
                            {target.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#2f3655]">{target.name}</p>
                            <p className="truncate text-[11px] text-[#8f97bb]">{target.handle}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            void handleForward(target.id);
                          }}
                          disabled={forwardMessageMutation.isPending}
                          className="h-8 min-w-[68px] rounded-xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-3 text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(96,91,255,0.16)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {forwardMessageMutation.isPending ? "Send..." : "Send"}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-[var(--line)] bg-white/84 px-3 py-3 text-[13px] text-[var(--muted)]">
                      No matching contacts or groups found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {removeTargetMessage ? (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center px-4 py-6"
          onClick={() => {
            setRemoveTargetMessageId(null);
            setRemoveScope("self");
          }}
        >
          <div
            className="w-full max-w-[440px] rounded-[20px] border border-[rgba(111,123,176,0.14)] bg-white shadow-[0_16px_36px_rgba(61,72,120,0.1)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-3.5 py-2.5 sm:px-4">
              <h2 className="pr-3 text-[18px] font-semibold tracking-[-0.03em] text-[#2f3655]">Message Remove</h2>
              <button
                type="button"
                onClick={() => {
                  setRemoveTargetMessageId(null);
                  setRemoveScope("self");
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(96,91,255,0.08)] bg-[var(--accent-soft)] text-[var(--accent)] transition hover:border-[rgba(96,91,255,0.18)] hover:bg-[rgba(96,91,255,0.16)]"
                aria-label="Close remove modal"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="px-3.5 py-3.5 sm:px-4">
              <div className="space-y-2.5">
                {removeTargetMessage.sender === "me" && removeTargetMessage.canUnsend ? (
                  <button
                    type="button"
                    onClick={() => setRemoveScope("everyone")}
                    className={`flex w-full items-start gap-2.5 rounded-[16px] px-1 py-1 text-left transition ${
                      removeScope === "everyone" ? "bg-[rgba(96,91,255,0.04)]" : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        removeScope === "everyone"
                          ? "border-[var(--accent)]"
                          : "border-[rgba(111,123,176,0.36)]"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full transition ${
                          removeScope === "everyone" ? "bg-[var(--accent)]" : "bg-transparent"
                        }`}
                      />
                    </span>
                    <span>
                      <span className="block text-[14px] font-semibold tracking-[-0.02em] text-[#2f3655]">
                        Unsend for everyone
                      </span>
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setRemoveScope("self")}
                  className={`flex w-full items-start gap-2.5 rounded-[16px] px-1 py-1 text-left transition ${
                    removeScope === "self" ? "bg-[rgba(96,91,255,0.04)]" : ""
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      removeScope === "self"
                        ? "border-[var(--accent)]"
                        : "border-[rgba(111,123,176,0.36)]"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        removeScope === "self" ? "bg-[var(--accent)]" : "bg-transparent"
                      }`}
                    />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold tracking-[-0.02em] text-[#2f3655]">
                      Remove for you
                    </span>
                  </span>
                </button>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRemoveTargetMessageId(null);
                    setRemoveScope("self");
                  }}
                  className="rounded-full px-3 py-1 text-[13px] font-semibold text-[#5d668c] transition hover:text-[var(--accent)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleRemove(removeTargetMessage.numericId, removeScope);
                  }}
                  disabled={deleteMessageMutation.isPending}
                  className="rounded-xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-[0_12px_24px_rgba(96,91,255,0.16)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteMessageMutation.isPending ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
