"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";

import { getDirectThreadPeer, toConversationThread } from "@/lib/messages-data";
import { useConversationQuery } from "@/lib/hooks/use-conversation-query";
import {
  useArchiveConversationMutation,
  useBlockConversationMutation,
  useSetConversationMuteMutation,
} from "@/lib/hooks/use-conversation-actions";
import { MessagesConfirmationModal } from "@/components/messages/messages-confirmation-modal";
import { MessagesMuteModal } from "@/components/messages/messages-mute-modal";
import { useChatUiStore } from "@/lib/stores/chat-ui-store";

const muteDurations = {
  "For 15 minutes": 15 * 60 * 1000,
  "For 1 Hour": 60 * 60 * 1000,
  "For 8 Hours": 8 * 60 * 60 * 1000,
  "For 24 Hours": 24 * 60 * 60 * 1000,
  "Until I turn it back on": null,
} as const;

export function MessagesConversationActionModals() {
  const router = useRouter();
  const {
    activeThreadId,
    confirmationAction,
    confirmationThreadId,
    isMuteModalOpen,
    muteThreadId,
    closeConfirmation,
    closeMuteModal,
  } = useChatUiStore(useShallow((state) => ({
    activeThreadId: state.activeThreadId,
    confirmationAction: state.confirmationAction,
    confirmationThreadId: state.confirmationThreadId,
    isMuteModalOpen: state.isMuteModalOpen,
    muteThreadId: state.muteThreadId,
    closeConfirmation: state.closeConfirmation,
    closeMuteModal: state.closeMuteModal,
  })));
  const targetThreadId = confirmationThreadId ?? muteThreadId;
  const { data: conversation } = useConversationQuery(targetThreadId ?? "");
  const archiveConversationMutation = useArchiveConversationMutation();
  const blockConversationMutation = useBlockConversationMutation();
  const setConversationMuteMutation = useSetConversationMuteMutation();

  const targetThread = useMemo(
    () => (conversation ? toConversationThread(conversation) : null),
    [conversation],
  );
  const directPeer = useMemo(
    () => (targetThread ? getDirectThreadPeer(targetThread) : null),
    [targetThread],
  );

  const isCurrentThreadTargeted =
    targetThreadId !== null && activeThreadId !== null && String(targetThreadId) === String(activeThreadId);

  const leaveCurrentThread = () => {
    if (isCurrentThreadTargeted) {
      router.push("/messages");
    }
  };

  const handleMuteConfirm = async (option: keyof typeof muteDurations) => {
    if (!muteThreadId) {
      closeMuteModal();
      return;
    }

    const targetMuteThreadId = muteThreadId;
    const duration = muteDurations[option];
    const mutedUntil = duration === null ? "2099-12-31T23:59:59Z" : new Date(Date.now() + duration).toISOString();
    closeMuteModal();

    try {
      await setConversationMuteMutation.mutateAsync({
        conversationId: targetMuteThreadId,
        mutedUntil,
      });
    } catch {
      // Cache invalidation restores the latest server state if the request fails.
    }
  };

  const handleBlockConfirm = async () => {
    if (!confirmationThreadId || !directPeer?.user_id) {
      closeConfirmation();
      return;
    }

    try {
      await blockConversationMutation.mutateAsync({
        conversationId: confirmationThreadId,
        userId: directPeer.user_id,
      });

      closeConfirmation();
      leaveCurrentThread();
    } catch {
      // Keep the modal open so the user can retry.
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmationThreadId) {
      closeConfirmation();
      return;
    }

    try {
      await archiveConversationMutation.mutateAsync(confirmationThreadId);
      closeConfirmation();
      leaveCurrentThread();
    } catch {
      // Keep the modal open so the user can retry.
    }
  };

  return (
    <>
      <MessagesMuteModal
        key={muteThreadId ?? "mute"}
        isOpen={isMuteModalOpen}
        isPending={setConversationMuteMutation.isPending}
        onClose={closeMuteModal}
        onConfirm={handleMuteConfirm}
      />
      <MessagesConfirmationModal
        isOpen={confirmationAction === "block"}
        title="Block conversation"
        description="You won't receive new messages from this person unless you unblock them later."
        confirmLabel="Block"
        isPending={blockConversationMutation.isPending}
        onClose={closeConfirmation}
        onConfirm={() => {
          void handleBlockConfirm();
        }}
      />
      <MessagesConfirmationModal
        isOpen={confirmationAction === "delete"}
        title="Delete chat"
        description="This will remove the chat from your list until a new message arrives."
        confirmLabel="Delete"
        isPending={archiveConversationMutation.isPending}
        onClose={closeConfirmation}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
      />
    </>
  );
}
