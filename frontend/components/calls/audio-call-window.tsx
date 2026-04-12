"use client";

import {
  ControlBar,
  LayoutContextProvider,
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { PhoneCall, PhoneOff, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  onLeave: () => void;
  isLeaving: boolean;
};

function AudioCallShell({ payload, title, onLeave, isLeaving }: AudioCallShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(93,108,255,0.18),transparent_30%),linear-gradient(180deg,#edf2ff_0%,#f8faff_100%)] px-5 py-6 text-[#2f3655]">
      <div className="flex h-[min(760px,100vh-3rem)] w-full max-w-[460px] flex-col overflow-hidden rounded-[32px] border border-[rgba(111,123,176,0.14)] bg-white shadow-[0_24px_70px_rgba(96,109,160,0.18)]">
        <header className="border-b border-[rgba(111,123,176,0.12)] px-5 py-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(96,91,255,0.14)_0%,rgba(130,147,255,0.24)_100%)] text-[var(--accent)]">
            <PhoneCall className="h-7 w-7" />
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9aa3c4]">Audio call</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-[#7580a8]">
            Room {payload.call_room.room_uuid.slice(0, 8)} · Mic only
          </p>
        </header>

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
          <LayoutContextProvider>
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="rounded-[28px] border border-[rgba(111,123,176,0.14)] bg-[linear-gradient(180deg,#fbfcff_0%,#f4f7ff_100%)] px-6 py-7 shadow-[0_18px_40px_rgba(96,109,160,0.08)]">
                <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-full bg-[rgba(96,91,255,0.08)] text-[var(--accent)]">
                  <PhoneCall className="h-8 w-8" />
                </div>
                <p className="mt-4 text-lg font-semibold">Voice call connected</p>
                <p className="mt-2 text-sm leading-6 text-[#7580a8]">
                  Keep this popup open while talking. You can mute the microphone or leave the call from below.
                </p>
              </div>
            </div>
            <div className="border-t border-[rgba(111,123,176,0.12)] bg-white px-4 py-4">
              <ControlBar
                variation="minimal"
                controls={{
                  microphone: true,
                  camera: false,
                  screenShare: false,
                  settings: true,
                  chat: false,
                  leave: false,
                }}
              />

              <div className="mt-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={onLeave}
                  disabled={isLeaving}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#ff6b83_0%,#ff4b6e_100%)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_16px_30px_rgba(255,75,110,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PhoneOff className="h-4 w-4" />
                  {isLeaving ? "Ending..." : "End call"}
                </button>
              </div>
            </div>
          </LayoutContextProvider>
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
