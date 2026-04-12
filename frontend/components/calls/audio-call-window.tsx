"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
} from "@livekit/components-react";
import { Ellipsis, Lock, Mic, MicOff, PhoneCall, PhoneOff, UserPlus, Video, Volume2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { ApiClientError, apiClient, ensureCsrfCookie } from "@/lib/api-client";
import {
  getCallParticipant,
  getDirectCallTargetUserId,
  isCallTerminal,
  type CallRoomApiItem,
  type JoinCallApiPayload,
} from "@/lib/calls-data";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useConversationQuery } from "@/lib/hooks/use-conversation-query";
import { toConversationThread, type MessageThread } from "@/lib/messages-data";

type CallRoomResponse = {
  data: CallRoomApiItem;
};

type JoinTokenResponse = {
  data: JoinCallApiPayload;
};

function normalizeLiveKitServerUrl(url: string | null | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol === "http:") {
      parsed.protocol = "ws:";
    } else if (parsed.protocol === "https:") {
      parsed.protocol = "wss:";
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=")[1] ?? "") : null;
}

function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return (
      error.errors?.call?.[0] ??
      error.errors?.message?.[0] ??
      error.errors?.conversation?.[0] ??
      error.message
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "We could not prepare the audio call.";
}

async function startVoiceCall(thread: MessageThread, authUserId: number): Promise<CallRoomApiItem> {
  if (thread.isChatBlocked || thread.membership?.membership_state === "request_pending") {
    throw new Error("This conversation is not ready for audio calling yet.");
  }

  if (thread.isGroup) {
    return apiClient
      .post<CallRoomResponse>(`/api/conversations/${thread.id}/calls/group/voice`)
      .then((response) => response.data);
  }

  const targetUserId = getDirectCallTargetUserId(thread, authUserId);

  if (!targetUserId) {
    throw new Error("We could not identify the other participant for this call.");
  }

  return apiClient
    .post<CallRoomResponse>(`/api/calls/direct/${targetUserId}/voice`)
    .then((response) => response.data);
}

async function createJoinToken(roomUuid: string) {
  return apiClient
    .post<JoinTokenResponse>(`/api/calls/${roomUuid}/join-token`, {
      wants_video: false,
    })
    .then((response) => response.data);
}

async function fetchCallRoom(roomUuid: string): Promise<CallRoomApiItem> {
  return apiClient
    .get<CallRoomResponse>(`/api/calls/${roomUuid}`)
    .then((response) => response.data);
}

type AudioCallShellProps = {
  payload: JoinCallApiPayload;
  title: string;
  avatarUrl?: string | null;
  onLeave: () => void;
  isLeaving: boolean;
};

function AudioCallActions({ onLeave, isLeaving }: { onLeave: () => void; isLeaving: boolean }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  const toggleMicrophone = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [isMicrophoneEnabled, localParticipant]);

  const disabledButtonClass =
    "inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/6 text-white/34 opacity-70";
  const activeButtonClass =
    "inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white shadow-[0_14px_24px_rgba(0,0,0,0.18)] transition hover:bg-white/14";

  return (
    <div className="flex items-center justify-center gap-4 px-4 pb-8 pt-3">
      <button
        type="button"
        disabled
        aria-label="Add user to group call"
        className={disabledButtonClass}
      >
        <UserPlus className="h-4.5 w-4.5" />
      </button>
      <button
        type="button"
        disabled
        aria-label="Switch to video call"
        className={disabledButtonClass}
      >
        <Video className="h-4.5 w-4.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          void toggleMicrophone();
        }}
        aria-label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
        className={activeButtonClass}
      >
        {isMicrophoneEnabled ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}
      </button>
      <button
        type="button"
        onClick={onLeave}
        disabled={isLeaving}
        aria-label={isLeaving ? "Ending call" : "End call"}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff5d72_0%,#ff3f62_100%)] text-white shadow-[0_18px_28px_rgba(255,75,110,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <PhoneOff className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}

function AudioCallShell({ payload, title, avatarUrl = null, onLeave, isLeaving }: AudioCallShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,189,141,0.18),transparent_22%),radial-gradient(circle_at_bottom,rgba(51,87,124,0.24),transparent_32%),linear-gradient(180deg,#262932_0%,#1f222c_100%)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-[12%] top-[12%] h-[34%] rounded-full bg-[radial-gradient(circle,rgba(165,108,86,0.42)_0%,rgba(165,108,86,0)_72%)] blur-3xl" />
        <div className="absolute inset-x-[10%] bottom-[8%] h-[38%] rounded-full bg-[radial-gradient(circle,rgba(42,68,96,0.42)_0%,rgba(42,68,96,0)_72%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_22%,rgba(8,10,16,0.2)_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[460px] flex-col">
        <LiveKitRoom
          token={payload.token.token}
          serverUrl={normalizeLiveKitServerUrl(payload.token.url)}
          connect
          audio
          video={false}
          data-lk-theme="default"
          className="flex min-h-0 flex-1 flex-col"
        >
          <RoomAudioRenderer />
          <header className="flex items-start justify-between gap-4 px-4 pb-3 pt-4">
            <div className="flex min-w-0 items-center gap-3">
              <MessageAvatar
                name={title}
                online={false}
                imageUrl={avatarUrl}
                sizeClass="h-12 w-12"
                textClass="text-base"
              />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-white/96">{title}</h1>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-white/72">
                  <Lock className="h-3.5 w-3.5" />
                  <span>End-to-end encrypted</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/82 shadow-[0_10px_24px_rgba(0,0,0,0.15)] backdrop-blur">
                <Volume2 className="mr-1.5 h-3.5 w-3.5" />
                Audio only
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/78 shadow-[0_10px_24px_rgba(0,0,0,0.15)] backdrop-blur">
                <Ellipsis className="h-4 w-4" />
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-6 text-center">
            <div className="relative">
              <div className="absolute inset-[-26px] rounded-full border border-white/8 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_68%)] blur-2xl" />
              <div className="absolute inset-[-12px] animate-pulse rounded-full border border-white/10" />
              <MessageAvatar
                name={title}
                online={false}
                imageUrl={avatarUrl}
                sizeClass="relative z-10 h-24 w-24"
                textClass="text-3xl"
              />
            </div>

            <div className="mt-7 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/62 shadow-[0_16px_36px_rgba(0,0,0,0.14)] backdrop-blur">
              Audio Call
            </div>
            <h2 className="mt-4 text-[2rem] font-semibold tracking-[-0.05em] text-white/96">{title}</h2>
          </div>

          <AudioCallActions onLeave={onLeave} isLeaving={isLeaving} />
        </LiveKitRoom>
      </div>
    </div>
  );
}

export function AudioCallWindow() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("conversationId") ?? "";
  const action = searchParams.get("action") ?? "start";
  const roomUuid = searchParams.get("roomUuid") ?? "";
  const { data: authMe } = useAuthMeQuery(true);
  const authUserId = authMe?.data.user?.id ?? null;
  const {
    data: conversation,
    isError: isConversationError,
  } = useConversationQuery(conversationId);
  const activeConversationRoomUuid = conversation?.active_room_uuid ?? "";
  const thread = useMemo(
    () => (conversation ? toConversationThread(conversation) : null),
    [conversation],
  );
  const [payload, setPayload] = useState<JoinCallApiPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const didInitializeRef = useRef(false);
  const didEndRef = useRef(false);

  const closeWindow = useCallback(() => {
    window.close();

    window.setTimeout(() => {
      if (!window.closed) {
        window.location.replace(conversationId ? `/messages/t/${conversationId}` : "/messages");
      }
    }, 120);
  }, [conversationId]);

  const endCall = useCallback(async (reason = "left_from_audio_popup", closeAfter = true) => {
    const activeRoomUuid = payload?.call_room.room_uuid ?? roomUuid;

    if (!activeRoomUuid || didEndRef.current) {
      if (closeAfter) {
        closeWindow();
      }

      return;
    }

    didEndRef.current = true;
    setIsLeaving(true);

    try {
      await apiClient.post(`/api/calls/${activeRoomUuid}/end`, {
        reason,
      });
    } catch {
      // Ignore best-effort end-call failures when closing the popup.
    } finally {
      setIsLeaving(false);

      if (closeAfter) {
        closeWindow();
      }
    }
  }, [closeWindow, payload?.call_room.room_uuid, roomUuid]);

  useEffect(() => {
    if (didInitializeRef.current) {
      return;
    }

    const normalizedAction = action === "accept" || action === "join" ? action : "start";

    if (!conversationId) {
      setErrorMessage("We could not resolve this conversation.");
      setIsPreparing(false);
      return;
    }

    if (normalizedAction === "start" && (!thread || !authUserId)) {
      if (isConversationError) {
        setErrorMessage("We could not load this conversation.");
        setIsPreparing(false);
      }

      return;
    }

    if ((normalizedAction === "accept" || normalizedAction === "join") && !roomUuid) {
      setErrorMessage("We could not resolve the call room.");
      setIsPreparing(false);
      return;
    }

    didInitializeRef.current = true;

    const run = async () => {
      try {
        await ensureCsrfCookie();

        let targetRoomUuid = roomUuid;

        if (normalizedAction === "start") {
          if (activeConversationRoomUuid) {
            const activeCallRoom = await fetchCallRoom(activeConversationRoomUuid);
            const participant = getCallParticipant(activeCallRoom, authUserId);

            if (!isCallTerminal(activeCallRoom)) {
              targetRoomUuid = activeCallRoom.room_uuid;

              if (participant && participant.invite_status !== "accepted") {
                await apiClient.post(`/api/calls/${targetRoomUuid}/accept`);
              }
            }
          }

          if (!targetRoomUuid) {
            const callRoom = await startVoiceCall(thread as MessageThread, authUserId as number);
            targetRoomUuid = callRoom.room_uuid;
          }
        } else if (normalizedAction === "accept") {
          await apiClient.post(`/api/calls/${roomUuid}/accept`);
        }

        const joinPayload = await createJoinToken(targetRoomUuid);
        setPayload(joinPayload);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error));
      } finally {
        setIsPreparing(false);
      }
    };

    void run();
  }, [action, activeConversationRoomUuid, authUserId, conversationId, isConversationError, roomUuid, thread]);

  useEffect(() => {
    if (!payload?.call_room.room_uuid) {
      return;
    }

    const activeRoomUuid = payload.call_room.room_uuid;

    const handleBeforeUnload = () => {
      if (didEndRef.current) {
        return;
      }

      didEndRef.current = true;

      const xsrfToken = getCookie("XSRF-TOKEN");
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

      void fetch(`${baseUrl}/api/calls/${activeRoomUuid}/end`, {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
        },
        body: JSON.stringify({
          reason: "audio_popup_closed",
        }),
      }).catch(() => {
        // Ignore browser shutdown failures.
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, [payload?.call_room.room_uuid]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(93,108,255,0.14),transparent_30%),linear-gradient(180deg,#edf2ff_0%,#f8faff_100%)]">
      {payload ? (
        <AudioCallShell
          payload={payload}
          title={thread?.name ?? "Voice call"}
          avatarUrl={thread?.avatarUrl ?? null}
          onLeave={() => {
            void endCall();
          }}
          isLeaving={isLeaving}
        />
      ) : (
        <div className="flex min-h-screen items-center justify-center px-5 py-6">
          <div className="w-full max-w-[420px] rounded-[28px] border border-[rgba(111,123,176,0.14)] bg-white px-6 py-7 text-center shadow-[0_24px_70px_rgba(96,109,160,0.12)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(96,91,255,0.08)] text-[var(--accent)]">
              {errorMessage ? <X className="h-7 w-7" /> : <PhoneCall className="h-7 w-7" />}
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#2f3655]">
              {errorMessage ? "Audio call unavailable" : "Preparing audio call"}
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#7580a8]">
              {errorMessage ?? "We are opening a separate voice call window for this conversation."}
            </p>

            {isPreparing && !errorMessage ? (
              <div className="mx-auto mt-5 h-10 w-10 animate-spin rounded-full border-2 border-[rgba(111,123,176,0.16)] border-t-[var(--accent)]" />
            ) : null}

            <div className="mt-6 flex items-center justify-center gap-2">
              {errorMessage ? (
                <button
                  type="button"
                  onClick={closeWindow}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
