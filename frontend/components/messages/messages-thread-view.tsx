"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { MessagesChatHeader } from "@/components/messages/messages-chat-header";
import { type MessagesImageViewerItem } from "@/components/messages/messages-image-viewer";
import { MessageBubble } from "@/components/messages/message-bubble";
import { MessageComposer } from "@/components/messages/message-composer";
import { BoneyardSkeleton } from "@/components/ui/boneyard-loading";
import { ApiClientError, apiClient } from "@/lib/api-client";
import { openCallWindow } from "@/lib/call-window";
import {
  type CallRoomApiItem,
  getCallParticipant,
  getDirectCallTargetUserId,
  isCallParticipantInactive,
  isCallTerminal,
} from "@/lib/calls-data";
import {
  useDeclineCallMutation,
} from "@/lib/hooks/use-call-mutations";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { useConversationMessagesQuery } from "@/lib/hooks/use-conversation-messages-query";
import { useMarkConversationReadMutation } from "@/lib/hooks/use-mark-read-mutation";
import { useAcceptMessageRequestMutation, useRejectMessageRequestMutation } from "@/lib/hooks/use-message-request-mutations";
import {
  useDeleteMessageMutation,
  useEditMessageMutation,
  useForwardMessageMutation,
  useSendMessageMutation,
  useToggleReactionMutation,
} from "@/lib/hooks/use-message-mutations";
import { useUnblockUserMutation } from "@/lib/hooks/use-conversation-actions";
import { useTypingUsersQuery } from "@/lib/hooks/use-typing-users-query";
import { toChatMessage, toConversationThread, type MessageThread } from "@/lib/messages-data";
import { type ChatMessage, type ComposerAttachmentInput, type ComposerVoiceInput } from "@/lib/messages-data";
import { useCallStore } from "@/lib/stores/call-store";
import { useConversationRealtimeStore } from "@/lib/stores/conversation-realtime-store";

const EMPTY_TYPING_USERS: { id: number; name: string }[] = [];

type MessagesThreadViewProps = {
  thread: MessageThread;
  sidebarView?: "messages" | "requests" | "archived" | "blocked";
  isInfoSidebarOpen: boolean;
  onToggleInfoSidebar: () => void;
  onOpenImageViewer?: (images: MessagesImageViewerItem[], activeImageId: string) => void;
};

export function MessagesThreadView({
  thread,
  sidebarView = "messages",
  isInfoSidebarOpen,
  onToggleInfoSidebar,
  onOpenImageViewer,
}: MessagesThreadViewProps) {
  const router = useRouter();
  const { data: authMe } = useAuthMeQuery(true);
  const currentUserId = authMe?.data.user?.id ?? null;
  const currentUserName = authMe?.data.user?.name ?? "You";
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useConversationMessagesQuery(thread.id);
  const sendMessageMutation = useSendMessageMutation();
  const toggleReactionMutation = useToggleReactionMutation(thread.id);
  const editMessageMutation = useEditMessageMutation(thread.id);
  const deleteMessageMutation = useDeleteMessageMutation(thread.id);
  const forwardMessageMutation = useForwardMessageMutation(thread.id);
  const unblockUserMutation = useUnblockUserMutation();
  const acceptRequestMutation = useAcceptMessageRequestMutation();
  const rejectRequestMutation = useRejectMessageRequestMutation();
  const markReadMutation = useMarkConversationReadMutation();
  const declineCallMutation = useDeclineCallMutation();
  const { data: forwardConversations = [] } = useConversationsQuery(true);
  const activeCall = useCallStore((state) => state.activeCall);
  const incomingCall = useCallStore((state) => state.incomingCall);
  const clearIncomingCall = useCallStore((state) => state.clearIncomingCall);
  const clearActiveCall = useCallStore((state) => state.clearActiveCall);
  const hydrateCallRoom = useCallStore((state) => state.hydrateCallRoom);
  const realtimeTypingUsers = useConversationRealtimeStore(
    (state) => state.typingUsersByConversation[thread.id] ?? EMPTY_TYPING_USERS,
  );
  const { data: polledTypingUsers = [] } = useTypingUsersQuery(thread.id, true);
  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const lastHydratedRoomUuidRef = useRef<string | null>(null);
  const previousScrollHeightRef = useRef<number | null>(null);
  const previousScrollTopRef = useRef<number>(0);
  const previousLatestSeqRef = useRef<number | null>(null);
  const hasInitialScrollRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [replyingMessageId, setReplyingMessageId] = useState<number | null>(null);
  const [forwardingMessageId, setForwardingMessageId] = useState<number | null>(null);
  const [forwardingSearch, setForwardingSearch] = useState("");
  const [removeTargetMessageId, setRemoveTargetMessageId] = useState<number | null>(null);
  const [removeScope, setRemoveScope] = useState<"self" | "everyone">("self");
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
  const [isOpeningVoiceCall, setIsOpeningVoiceCall] = useState(false);
  const [isOpeningVideoCall, setIsOpeningVideoCall] = useState(false);
  const [isAcceptingIncomingCall, setIsAcceptingIncomingCall] = useState(false);

  const serverMessages = useMemo(
    () => messages.map((message) => toChatMessage(message, currentUserId ?? undefined)),
    [currentUserId, messages],
  );
  const mappedMessages = useMemo(
    () => [...serverMessages, ...pendingMessages].sort((left, right) => left.seq - right.seq),
    [pendingMessages, serverMessages],
  );
  const latestMessage = messages.at(-1) ?? null;
  const activeMembership = thread.membership ?? null;
  const isBlockedConversation = Boolean(thread.isChatBlocked);
  const isRequestConversation = sidebarView === "requests" || activeMembership?.membership_state === "request_pending";
  const canCompose = !isBlockedConversation && !isRequestConversation;
  const canMessageInteract = !isBlockedConversation && !isRequestConversation;
  const peerMembership = thread.isGroup
    ? null
    : (thread.members ?? []).find((member) => member.user_id !== currentUserId) ?? null;
  const blockedPeerUserId = isBlockedConversation ? peerMembership?.user_id ?? null : null;

  const activeComposerError = editingMessageId ? editMessageMutation.error : sendMessageMutation.error;
  const composerErrorMessage =
    activeComposerError instanceof ApiClientError
      ? activeComposerError.errors?.file?.[0] ??
        activeComposerError.errors?.storage_object_id?.[0] ??
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
  const incomingCallForThread =
    incomingCall?.callRoom.conversation_id === thread.numericId ? incomingCall : null;
  const typingUsers = polledTypingUsers.length > 0 ? polledTypingUsers : realtimeTypingUsers;
  const removeTargetMessage = useMemo(
    () => mappedMessages.find((message) => message.numericId === removeTargetMessageId) ?? null,
    [mappedMessages, removeTargetMessageId],
  );
  const editingMessage = useMemo(
    () => mappedMessages.find((message) => message.numericId === editingMessageId) ?? null,
    [mappedMessages, editingMessageId],
  );
  const replyingMessage = useMemo(
    () => mappedMessages.find((message) => message.numericId === replyingMessageId) ?? null,
    [mappedMessages, replyingMessageId],
  );
  const galleryImages = useMemo(
    () =>
      mappedMessages.flatMap((message) =>
        (message.attachments ?? [])
          .filter((attachment) => attachment.mediaKind === "image" && attachment.downloadUrl && !attachment.isExpired)
          .map((attachment) => ({
            id: attachment.id,
            url: attachment.downloadUrl as string,
            name: attachment.name,
          })),
      ),
    [mappedMessages],
  );
  const forwardTargets = useMemo(
    () => forwardConversations.map((conversation) => toConversationThread(conversation)),
    [forwardConversations],
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

  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    shouldStickToBottomRef.current = true;
  }, []);

  useEffect(() => {
    hasInitialScrollRef.current = false;
    previousLatestSeqRef.current = null;
    previousScrollHeightRef.current = null;
    shouldStickToBottomRef.current = true;

    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [scrollToBottom, thread.id]);

  useEffect(() => {
    if (!latestMessage || !activeMembership || markReadMutation.isPending || activeMembership.membership_state !== "active") {
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
      scrollToBottom();
      hasInitialScrollRef.current = true;
    }
  }, [isFetchingNextPage, latestMessage?.seq, mappedMessages.length, scrollToBottom]);

  const handleLoadOlder = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    const container = scrollContainerRef.current;

    if (container) {
      previousScrollHeightRef.current = container.scrollHeight;
      previousScrollTopRef.current = container.scrollTop;
    }

    await fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
      shouldStickToBottomRef.current = distanceFromBottom < 160;
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [thread.id]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const sentinel = topSentinelRef.current;

    if (!container || !sentinel || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry?.isIntersecting) {
          void handleLoadOlder();
        }
      },
      {
        root: container,
        rootMargin: "120px 0px 0px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [handleLoadOlder, hasNextPage, thread.id]);

  const handleStartCall = useCallback((mediaType: "voice" | "video") => {
    if (isBlockedConversation || isRequestConversation) {
      return;
    }

    if (mediaType === "voice") {
      setIsOpeningVoiceCall(true);
    } else {
      setIsOpeningVideoCall(true);
    }

    openCallWindow({
      conversationId: thread.id,
      action: "start",
      mediaType,
      title: thread.name,
      avatarUrl: thread.avatarUrl ?? null,
      targetUserId: thread.isGroup ? null : getDirectCallTargetUserId(thread, currentUserId ?? 0),
      isGroup: Boolean(thread.isGroup),
    });

    window.setTimeout(() => {
      if (mediaType === "voice") {
        setIsOpeningVoiceCall(false);
      } else {
        setIsOpeningVideoCall(false);
      }
    }, 220);
  }, [currentUserId, isBlockedConversation, isRequestConversation, thread]);

  const handleRetryCall = useCallback((message: ChatMessage) => {
    openCallWindow({
      conversationId: thread.id,
      action: "start",
      mediaType: message.call?.mediaType ?? "voice",
      title: thread.name,
      avatarUrl: thread.avatarUrl ?? null,
      targetUserId: thread.isGroup ? null : getDirectCallTargetUserId(thread, currentUserId ?? 0),
      isGroup: Boolean(thread.isGroup),
    });
  }, [currentUserId, thread]);

  useEffect(() => {
    if (!currentUserId || !thread.activeRoomUuid) {
      lastHydratedRoomUuidRef.current = null;
      return;
    }

    if (
      currentCallForThread?.callRoom.room_uuid === thread.activeRoomUuid ||
      incomingCallForThread?.callRoom.room_uuid === thread.activeRoomUuid ||
      lastHydratedRoomUuidRef.current === thread.activeRoomUuid
    ) {
      return;
    }

    lastHydratedRoomUuidRef.current = thread.activeRoomUuid;
    let isCancelled = false;

    const hydrateThreadCall = async () => {
      try {
        const response = await apiClient.get<{ data: CallRoomApiItem }>(`/api/calls/${thread.activeRoomUuid}`, {
          skipAuthRedirect: true,
        });

        if (isCancelled) {
          return;
        }

        const participant = getCallParticipant(response.data, currentUserId);

        if (isCallTerminal(response.data) || isCallParticipantInactive(participant)) {
          return;
        }

        hydrateCallRoom(response.data, currentUserId);
      } catch {
        lastHydratedRoomUuidRef.current = null;
      }
    };

    void hydrateThreadCall();

    return () => {
      isCancelled = true;
    };
  }, [currentCallForThread?.callRoom.room_uuid, currentUserId, hydrateCallRoom, incomingCallForThread?.callRoom.room_uuid, thread.activeRoomUuid]);

  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
    setEditingValue("");
  }, [setEditingMessageId, setEditingValue]);

  const cancelReplying = useCallback(() => {
    setReplyingMessageId(null);
  }, [setReplyingMessageId]);

  const handleSaveEdit = useCallback(async (messageId: number) => {
    if (!editingValue.trim()) {
      return;
    }

    await editMessageMutation.mutateAsync({
      conversationId: thread.id,
      messageId,
      text: editingValue,
    });

    cancelEditing();
  }, [cancelEditing, editMessageMutation, editingValue, thread.id]);

  const handleRemove = async (messageId: number, scope: "self" | "everyone") => {
    await deleteMessageMutation.mutateAsync({
      conversationId: thread.id,
      messageId,
      scope,
    });

    setRemoveTargetMessageId(null);
    setRemoveScope("self");
  };

  const handleForward = useCallback(async (targetConversationId: string) => {
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
  }, [forwardMessageMutation, forwardingMessageId, setForwardingMessageId, setForwardingSearch, thread.id]);

  const handleMediaLoad = useCallback(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [scrollToBottom]);

  const handleReplyMessage = useCallback((messageId: number) => {
    setEditingMessageId(null);
    setEditingValue("");
    setReplyingMessageId(messageId);
  }, [setEditingMessageId, setEditingValue, setReplyingMessageId]);

  const handleEditMessage = useCallback((messageId: number, currentBody: string) => {
    setReplyingMessageId(null);
    setEditingMessageId(messageId);
    setEditingValue(currentBody);
  }, [setEditingMessageId, setEditingValue, setReplyingMessageId]);

  const handleForwardMessage = useCallback((messageId: number) => {
    setForwardingMessageId(messageId);
  }, [setForwardingMessageId]);

  const handleRemoveMessage = useCallback((messageId: number) => {
    setRemoveTargetMessageId(messageId);
    setRemoveScope("self");
  }, [setRemoveScope, setRemoveTargetMessageId]);

  const handleOpenImage = useCallback((attachmentId: string) => {
    onOpenImageViewer?.(galleryImages, attachmentId);
  }, [galleryImages, onOpenImageViewer]);

  const handleToggleReaction = useCallback((messageId: number, emoji: string, hasReacted: boolean) => {
    void toggleReactionMutation.mutateAsync({
      messageId,
      emoji,
      hasReacted,
    });
  }, [toggleReactionMutation]);

  const reactingMessageId = toggleReactionMutation.isPending ? toggleReactionMutation.variables?.messageId ?? null : null;

  const buildPendingMessage = useCallback(({
    text,
    attachments,
    voice,
    replyToMessageId,
  }: {
    text: string;
    attachments: ComposerAttachmentInput[];
    voice: ComposerVoiceInput | null;
    replyToMessageId?: number | null;
  }): ChatMessage => {
    const nextSeq = (mappedMessages.at(-1)?.seq ?? latestMessage?.seq ?? 0) + 1;
    const voiceUrl = voice ? URL.createObjectURL(voice.file) : null;
    const quotedMessage =
      replyToMessageId !== undefined && replyToMessageId !== null
        ? mappedMessages.find((message) => message.numericId === replyToMessageId) ?? null
        : null;

    return {
      id: `pending-${crypto.randomUUID()}`,
      numericId: -Date.now(),
      seq: nextSeq,
      type: voice ? "voice" : "text",
      sender: "me",
      senderId: currentUserId ?? 0,
      body: text.trim() || (voice ? "" : attachments.some((item) => item.kind === "image") ? "Photo" : "File"),
      time: "Now",
      senderName: currentUserName,
      canEdit: false,
      canUnsend: false,
      isPending: true,
      quote: quotedMessage
        ? {
            senderName: quotedMessage.sender === "me" ? "You" : quotedMessage.senderName,
            text: quotedMessage.body,
          }
        : null,
      reactions: [],
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.file.name,
        mimeType: attachment.file.type || "application/octet-stream",
        mediaKind: attachment.kind === "image" ? "image" : "file",
        sizeBytes: attachment.file.size,
        width: null,
        height: null,
        durationMs: null,
        downloadUrl: attachment.previewUrl ?? null,
        isExpired: false,
        placeholderText: null,
      })),
      ...(voice
        ? {
            attachments: [
              {
                id: voice.id,
                name: voice.file.name,
                mimeType: voice.file.type || "audio/webm",
                mediaKind: "voice" as const,
                sizeBytes: voice.file.size,
                width: null,
                height: null,
                durationMs: voice.durationMs,
                downloadUrl: voiceUrl,
                isExpired: false,
                placeholderText: null,
              },
            ],
          }
        : {}),
    };
  }, [currentUserId, currentUserName, latestMessage?.seq, mappedMessages]);

  const revokePendingMessageUrls = useCallback((message: ChatMessage) => {
    message.attachments?.forEach((attachment) => {
      if (attachment.downloadUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(attachment.downloadUrl);
      }
    });
  }, []);

  const replyPreview = useMemo(
    () =>
      replyingMessage
        ? {
            senderName: replyingMessage.sender === "me" ? "You" : (replyingMessage.senderName ?? undefined),
            text: replyingMessage.body,
          }
        : null,
    [replyingMessage],
  );

  const handleStartVoiceCall = useCallback(() => {
    handleStartCall("voice");
  }, [handleStartCall]);

  const handleStartVideoCall = useCallback(() => {
    handleStartCall("video");
  }, [handleStartCall]);

  const handleAcceptIncomingCall = useCallback(async () => {
    if (!incomingCallForThread) {
      return;
    }

    setIsAcceptingIncomingCall(true);

    try {
      openCallWindow({
        conversationId: thread.id,
        action: "accept",
        mediaType: incomingCallForThread.callRoom.media_type,
        roomUuid: incomingCallForThread.callRoom.room_uuid,
        title: thread.name,
        avatarUrl: thread.avatarUrl ?? null,
        isGroup: Boolean(thread.isGroup),
      });
      clearIncomingCall();
      clearActiveCall();
    } finally {
      setIsAcceptingIncomingCall(false);
    }
  }, [
    clearActiveCall,
    clearIncomingCall,
    incomingCallForThread,
    thread,
  ]);

  const handleDeclineIncomingCall = useCallback(async () => {
    if (!incomingCallForThread) {
      return;
    }

    await declineCallMutation.mutateAsync(incomingCallForThread.callRoom.room_uuid);
  }, [declineCallMutation, incomingCallForThread]);

  const handleUnblock = useCallback(async () => {
    if (!blockedPeerUserId) {
      return;
    }

    await unblockUserMutation.mutateAsync(blockedPeerUserId);
    router.push("/messages");
  }, [blockedPeerUserId, router, unblockUserMutation]);

  const handleAcceptRequest = useCallback(async () => {
    await acceptRequestMutation.mutateAsync(thread.numericId);
    router.push(`/messages/t/${thread.id}`);
  }, [acceptRequestMutation, router, thread.id, thread.numericId]);

  const handleDeclineRequest = useCallback(async () => {
    await rejectRequestMutation.mutateAsync(thread.numericId);
    router.push("/messages/message-requests");
  }, [rejectRequestMutation, router, thread.numericId]);

  const handleSendMessage = useCallback(async ({
    text,
    attachments,
    voice,
    gif,
  }: {
    text: string;
    attachments: ComposerAttachmentInput[];
    voice: ComposerVoiceInput | null;
    gif: null;
  }) => {
    if (editingMessageId) {
      await handleSaveEdit(editingMessageId);
      return;
    }

    const optimisticMessage = buildPendingMessage({
      text,
      attachments,
      voice,
      replyToMessageId: replyingMessageId,
    });

    setPendingMessages((current) => [...current, optimisticMessage]);

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: thread.id,
        text,
        attachments,
        voice,
        gif,
        replyToMessageId: replyingMessageId,
      });
    } catch (error) {
      setPendingMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      revokePendingMessageUrls(optimisticMessage);
      throw error;
    }

    setPendingMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
    revokePendingMessageUrls(optimisticMessage);
    cancelReplying();
  }, [
    buildPendingMessage,
    cancelReplying,
    editingMessageId,
    handleSaveEdit,
    replyingMessageId,
    revokePendingMessageUrls,
    sendMessageMutation,
    thread.id,
  ]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-white/60">
      <MessagesChatHeader
        thread={thread}
        isInfoSidebarOpen={isInfoSidebarOpen}
        onToggleInfoSidebar={onToggleInfoSidebar}
        onStartVoiceCall={canCompose ? handleStartVoiceCall : undefined}
        onStartVideoCall={canCompose ? handleStartVideoCall : undefined}
        isStartingVoiceCall={isOpeningVoiceCall}
        isStartingVideoCall={isOpeningVideoCall}
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.45)_0%,rgba(246,248,255,0.72)_100%)] px-4 py-5 sm:px-6"
      >
        <div ref={topSentinelRef} className="h-px w-full" aria-hidden="true" />
        <div className="-mx-1 flex justify-center pb-2 pt-1">
          {hasNextPage ? (
            isFetchingNextPage ? (
              <BoneyardSkeleton name="messages-older-page" loading={isFetchingNextPage} fallback={<div className="h-8 w-44 animate-pulse rounded-full bg-white/90" />}>
                <div className="h-8 w-44 rounded-full bg-white/90" />
              </BoneyardSkeleton>
            ) : null
          ) : mappedMessages.length > 0 ? (
            <div className="rounded-full border border-[rgba(111,123,176,0.12)] bg-white/80 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#99a1c2]">
              Conversation start
            </div>
          ) : null}
        </div>

        {currentCallForThread ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(96,91,255,0.14)] bg-[rgba(96,91,255,0.06)] px-4 py-3 text-sm text-[#575f86]">
            <span>
              {currentCallForThread.token ? (
                <>
                  {currentCallForThread.callRoom.media_type === "video" ? "Video" : "Voice"} session ready in{" "}
                  <span className="font-medium text-[#2f3655]">{currentCallForThread.publishMode}</span> mode.
                </>
              ) : currentCallForThread.source === "synced" ? (
                <>
                  {currentCallForThread.callRoom.media_type === "video" ? "Video" : "Voice"} call is active on another device.
                  Move it <span className="font-medium text-[#2f3655]">here</span> to continue.
                </>
              ) : (
                <>
                  {currentCallForThread.callRoom.media_type === "video" ? "Video" : "Voice"} call is{" "}
                  <span className="font-medium text-[#2f3655]">{currentCallForThread.callRoom.status}</span>.
                </>
              )}
            </span>

            {currentCallForThread.token ? (
              <button
                type="button"
                onClick={() => {
                  openCallWindow({
                    conversationId: thread.id,
                    action: "join",
                    mediaType: currentCallForThread.callRoom.media_type,
                    roomUuid: currentCallForThread.callRoom.room_uuid,
                    title: thread.name,
                    avatarUrl: thread.avatarUrl ?? null,
                    isGroup: Boolean(thread.isGroup),
                  });
                }}
                className="rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(96,91,255,0.18)] transition hover:brightness-105"
              >
                {currentCallForThread.callRoom.media_type === "video" ? "Open video window" : "Open call window"}
              </button>
            ) : currentCallForThread.source === "synced" ? (
              <button
                type="button"
                onClick={() => {
                  openCallWindow({
                    conversationId: thread.id,
                    action: "join",
                    mediaType: currentCallForThread.callRoom.media_type,
                    roomUuid: currentCallForThread.callRoom.room_uuid,
                    title: thread.name,
                    avatarUrl: thread.avatarUrl ?? null,
                    isGroup: Boolean(thread.isGroup),
                  });
                }}
                className="rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(96,91,255,0.18)] transition hover:brightness-105"
              >
                Move call here
              </button>
            ) : null}
          </div>
        ) : null}

        {incomingCallForThread ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-[rgba(96,91,255,0.14)] bg-[rgba(96,91,255,0.06)] px-4 py-3 text-sm text-[#575f86]">
            <p>
              Incoming {incomingCallForThread.callRoom.media_type === "video" ? "video" : "voice"} call for this conversation.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleAcceptIncomingCall();
                }}
                disabled={isAcceptingIncomingCall}
                className="rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(96,91,255,0.16)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAcceptingIncomingCall ? "Opening..." : "Accept"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeclineIncomingCall();
                }}
                disabled={declineCallMutation.isPending}
                className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {declineCallMutation.isPending ? "Declining..." : "Decline"}
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <BoneyardSkeleton
            name="messages-thread-timeline"
            loading={isLoading}
            fallback={
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
            }
          >
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`message-fixture-${index}`}
                  className={`h-20 rounded-[26px] border border-[var(--line)] ${
                    index % 2 === 0 ? "mr-auto max-w-[72%]" : "ml-auto max-w-[58%]"
                  } bg-white/70`}
                />
              ))}
            </div>
          </BoneyardSkeleton>
        ) : null}

        {isError ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            We could not load this conversation timeline.
          </div>
        ) : null}

        {!isLoading && !isError && isBlockedConversation ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            You can view this chat, but messaging is blocked for this conversation.
          </div>
        ) : null}

        {!isLoading && !isError && isRequestConversation ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
            This conversation is still a message request. Accept it to start messaging.
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
              authUserId={currentUserId}
              onReply={handleReplyMessage}
              onEdit={handleEditMessage}
              onForward={handleForwardMessage}
              onRemove={handleRemoveMessage}
              onOpenImage={handleOpenImage}
              onMediaLoad={handleMediaLoad}
              canInteract={canMessageInteract}
              onRetryCall={canCompose ? handleRetryCall : undefined}
              readLabel={
                message.isPending
                  ? "Sending..."
                  : !thread.isGroup && message.sender === "me" && peerMembership
                  ? peerMembership.last_read_seq >= message.seq
                    ? "Seen"
                    : "Sent"
                  : null
              }
              onToggleReaction={handleToggleReaction}
              isReacting={reactingMessageId === message.numericId}
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

        {canCompose ? (
          <MessageComposer
            threadName={thread.name}
            conversationId={thread.id}
            isEditing={Boolean(editingMessage)}
            editingValue={editingValue}
            editingMessagePreview={editingMessage?.body ?? null}
            replyPreview={replyPreview}
            onEditingValueChange={setEditingValue}
            onCancelEditing={cancelEditing}
            onCancelReply={cancelReplying}
            isSending={editMessageMutation.isPending || sendMessageMutation.isPending}
            errorMessage={composerErrorMessage}
            onSend={handleSendMessage}
          />
        ) : (
          <div className="flex items-center justify-center">
            <div
              className={`flex w-full max-w-xl flex-col items-center justify-center rounded-2xl px-4 py-4 text-center text-sm font-medium ${
                isBlockedConversation
                  ? "border border-rose-200 bg-rose-50 text-rose-600"
                  : "border border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <p>
                {isBlockedConversation
                  ? "You can't message this account until it is unblocked."
                  : "Accept this message request to start chatting."}
              </p>

              {isBlockedConversation && blockedPeerUserId ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleUnblock();
                  }}
                  disabled={unblockUserMutation.isPending}
                  className="mt-3 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {unblockUserMutation.isPending ? "Unblocking..." : "Unblock"}
                </button>
              ) : null}

              {isRequestConversation ? (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleAcceptRequest();
                    }}
                    disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {acceptRequestMutation.isPending ? "Accepting..." : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeclineRequest();
                    }}
                    disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                    className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {rejectRequestMutation.isPending ? "Declining..." : "Decline"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
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
                      (() => {
                        const isSendingToTarget =
                          forwardMessageMutation.isPending &&
                          forwardMessageMutation.variables?.targetConversationId === target.id;

                        return (
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
                                <p className="truncate text-[11px] text-[#8f97bb]">
                                  {target.handle}
                                  {target.id === thread.id ? " · Current chat" : ""}
                                </p>
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
                              {isSendingToTarget ? "Send..." : "Send"}
                            </button>
                          </div>
                        );
                      })()
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
