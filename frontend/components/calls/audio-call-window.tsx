"use client";

import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
} from "@livekit/components-react";
import { Camera, CameraOff, Lock, Mic, MicOff, PhoneCall, PhoneOff, UserPlus, Video, X } from "lucide-react";
import { ConnectionState, Track } from "livekit-client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { ApiClientError, apiClient, ensureCsrfCookie } from "@/lib/api-client";
import {
  type CallSignalPayload,
  formatCallStatus,
  getCallParticipant,
  getDirectCallTargetUserId,
  isCallTerminal,
  type CallRoomApiItem,
  type JoinCallApiPayload,
} from "@/lib/calls-data";
import { publishPopupClosingSignal } from "@/lib/call-popup-sync";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useConversationQuery } from "@/lib/hooks/use-conversation-query";
import { toConversationThread, type MessageThread } from "@/lib/messages-data";
import { getEchoInstance } from "@/lib/reverb";

type CallRoomResponse = {
  data: CallRoomApiItem;
};

type JoinTokenResponse = {
  data: JoinCallApiPayload;
};

function formatCallDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function getCallUiStatus(callRoom: CallRoomApiItem | null | undefined): string {
  if (!callRoom) {
    return "Preparing";
  }

  return callRoom.status === "active" ? "In call" : formatCallStatus(callRoom);
}

function getRealtimeStatus(
  callRoom: CallRoomApiItem,
  connectionState: ConnectionState,
  remoteParticipantCount: number,
): string {
  if (connectionState === ConnectionState.Connected && remoteParticipantCount > 0) {
    return "In call";
  }

  if (
    (callRoom.status === "connecting" || callRoom.status === "active") &&
    (connectionState === ConnectionState.Connecting ||
      connectionState === ConnectionState.Reconnecting ||
      connectionState === ConnectionState.SignalReconnecting ||
      (connectionState === ConnectionState.Connected && remoteParticipantCount === 0))
  ) {
    return "Connecting";
  }

  return getCallUiStatus(callRoom);
}

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

  return "We could not prepare the call.";
}

async function startCall(
  thread: MessageThread,
  authUserId: number,
  mediaType: "voice" | "video",
): Promise<CallRoomApiItem> {
  if (thread.isChatBlocked || thread.membership?.membership_state === "request_pending") {
    throw new Error("This conversation is not ready for calling yet.");
  }

  if (thread.isGroup) {
    return apiClient
      .post<CallRoomResponse>(`/api/conversations/${thread.id}/calls/group/${mediaType}`)
      .then((response) => response.data);
  }

  const targetUserId = getDirectCallTargetUserId(thread, authUserId);

  if (!targetUserId) {
    throw new Error("We could not identify the other participant for this call.");
  }

  return apiClient
    .post<CallRoomResponse>(`/api/calls/direct/${targetUserId}/${mediaType}`)
    .then((response) => response.data);
}

async function startCallFast(
  conversationId: string,
  options: {
    targetUserId?: number | null;
    isGroup?: boolean;
    mediaType: "voice" | "video";
  },
): Promise<CallRoomApiItem> {
  if (options.isGroup) {
    return apiClient
      .post<CallRoomResponse>(`/api/conversations/${conversationId}/calls/group/${options.mediaType}`)
      .then((response) => response.data);
  }

  if (typeof options.targetUserId === "number") {
    return apiClient
      .post<CallRoomResponse>(`/api/calls/direct/${options.targetUserId}/${options.mediaType}`)
      .then((response) => response.data);
  }

  throw new Error("We could not identify the other participant for this call.");
}

async function createJoinToken(roomUuid: string, wantsVideo = false) {
  return apiClient
    .post<JoinTokenResponse>(`/api/calls/${roomUuid}/join-token`, {
      wants_video: wantsVideo,
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

function useCallStageMeta(callRoom: CallRoomApiItem) {
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const remoteParticipantCount = remoteParticipants.length;
  const [connectedAtMs, setConnectedAtMs] = useState<number | null>(
    callRoom.started_at ? new Date(callRoom.started_at).getTime() : null,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(callRoom.duration_seconds ?? 0);

  useEffect(() => {
    const nextConnectedAt = callRoom.started_at ? new Date(callRoom.started_at).getTime() : null;
    const timeoutId = window.setTimeout(() => {
      setConnectedAtMs(nextConnectedAt);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [callRoom.room_uuid, callRoom.started_at]);

  useEffect(() => {
    const shouldMarkConnected =
      connectionState === ConnectionState.Connected && remoteParticipantCount > 0;

    if (!shouldMarkConnected) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setConnectedAtMs((current) => current ?? Date.now());
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [connectionState, remoteParticipantCount]);

  useEffect(() => {
    const isInCall = connectionState === ConnectionState.Connected && remoteParticipantCount > 0;

    const syncDuration = () => {
      if (isInCall && connectedAtMs) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - connectedAtMs) / 1000)));
        return;
      }

      setElapsedSeconds(callRoom.duration_seconds ?? 0);
    };

    const timeoutId = window.setTimeout(syncDuration, 0);
    const intervalId = isInCall ? window.setInterval(syncDuration, 1000) : null;

    return () => {
      window.clearTimeout(timeoutId);

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [callRoom.duration_seconds, connectedAtMs, connectionState, remoteParticipantCount]);

  const statusLabel = getRealtimeStatus(callRoom, connectionState, remoteParticipantCount);
  const durationLabel = statusLabel === "In call" ? formatCallDuration(elapsedSeconds) : null;

  return {
    statusLabel,
    durationLabel,
  };
}

function CallWindowHeader({
  title,
  avatarUrl = null,
  statusLabel,
  durationLabel,
}: {
  title: string;
  avatarUrl?: string | null;
  statusLabel: string;
  durationLabel: string | null;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-4 pb-3 pt-4 md:px-5">
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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-medium text-white/82 backdrop-blur">
              {durationLabel ? `${statusLabel} · ${durationLabel}` : statusLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-[11px] font-medium text-white/62 backdrop-blur">
              <Lock className="h-3.5 w-3.5" />
              End-to-end encrypted
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function CallPopupControls({
  isVideoCall,
  onLeave,
  isLeaving,
}: {
  isVideoCall: boolean;
  onLeave: () => void;
  isLeaving: boolean;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-6">
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[rgba(12,16,31,0.84)] px-4 py-3 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => {
            void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
          }}
          aria-label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white shadow-[0_14px_24px_rgba(0,0,0,0.18)] transition hover:bg-white/14"
        >
          {isMicrophoneEnabled ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}
        </button>

        {isVideoCall ? (
          <button
            type="button"
            onClick={() => {
              void localParticipant.setCameraEnabled(!isCameraEnabled);
            }}
            aria-label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white shadow-[0_14px_24px_rgba(0,0,0,0.18)] transition hover:bg-white/14"
          >
            {isCameraEnabled ? <Camera className="h-4.5 w-4.5" /> : <CameraOff className="h-4.5 w-4.5" />}
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-label="Add user to group call"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/6 text-white/34 opacity-70"
          >
            <UserPlus className="h-4.5 w-4.5" />
          </button>
        )}

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
    </div>
  );
}

function AudioCallStage({
  callRoom,
  title,
  avatarUrl = null,
  onLeave,
  isLeaving,
}: {
  callRoom: CallRoomApiItem;
  title: string;
  avatarUrl?: string | null;
  onLeave: () => void;
  isLeaving: boolean;
}) {
  const { statusLabel, durationLabel } = useCallStageMeta(callRoom);

  return (
    <>
      <RoomAudioRenderer />
      <CallWindowHeader title={title} avatarUrl={avatarUrl} statusLabel={statusLabel} durationLabel={durationLabel} />

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
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
          {statusLabel}
        </div>
        <h2 className="mt-4 text-[2rem] font-semibold tracking-[-0.05em] text-white/96">{title}</h2>
        <p className="mt-2 text-sm font-medium text-white/70">
          {durationLabel ? `${statusLabel} · ${durationLabel}` : statusLabel}
        </p>
      </div>

      <CallPopupControls isVideoCall={false} onLeave={onLeave} isLeaving={isLeaving} />
    </>
  );
}

function VideoParticipantGrid() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });

  return (
    <div className="grid flex-1 auto-rows-[minmax(220px,1fr)] grid-cols-1 gap-4 overflow-auto p-5 md:grid-cols-2">
      {tracks.map((trackRef) => {
        const key = `${trackRef.participant.identity}-${trackRef.source}`;

        return (
          <div
            key={key}
            className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,24,44,0.96)_0%,rgba(14,18,34,0.94)_100%)] shadow-[0_28px_70px_rgba(4,8,20,0.42)]"
          >
            <ParticipantTile trackRef={trackRef} />
          </div>
        );
      })}
    </div>
  );
}

function VideoCallStage({
  callRoom,
  title,
  avatarUrl = null,
  onLeave,
  isLeaving,
}: {
  callRoom: CallRoomApiItem;
  title: string;
  avatarUrl?: string | null;
  onLeave: () => void;
  isLeaving: boolean;
}) {
  const { statusLabel, durationLabel } = useCallStageMeta(callRoom);

  return (
    <>
      <RoomAudioRenderer />
      <CallWindowHeader title={title} avatarUrl={avatarUrl} statusLabel={statusLabel} durationLabel={durationLabel} />

      <div className="flex min-h-0 flex-1 px-4 pb-24 pt-2 md:px-5">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-[34px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,29,0.92)_0%,rgba(8,12,22,0.94)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_32px_90px_rgba(0,0,0,0.34)]">
          <VideoParticipantGrid />
        </div>
      </div>

      <CallPopupControls isVideoCall onLeave={onLeave} isLeaving={isLeaving} />
    </>
  );
}

function AudioCallShell({ payload, title, avatarUrl = null, onLeave, isLeaving }: AudioCallShellProps) {
  const isVideoCall = payload.call_room.media_type === "video";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,189,141,0.14),transparent_18%),radial-gradient(circle_at_bottom,rgba(51,87,124,0.22),transparent_28%),linear-gradient(180deg,#141927_0%,#0e1320_100%)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-[12%] top-[12%] h-[34%] rounded-full bg-[radial-gradient(circle,rgba(165,108,86,0.42)_0%,rgba(165,108,86,0)_72%)] blur-3xl" />
        <div className="absolute inset-x-[10%] bottom-[8%] h-[38%] rounded-full bg-[radial-gradient(circle,rgba(42,68,96,0.42)_0%,rgba(42,68,96,0)_72%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_22%,rgba(8,10,16,0.2)_100%)]" />
      </div>

      <div className={`relative mx-auto flex min-h-screen w-full flex-col ${isVideoCall ? "max-w-[1280px]" : "max-w-[460px]"}`}>
        <LiveKitRoom
          token={payload.token.token}
          serverUrl={normalizeLiveKitServerUrl(payload.token.url)}
          connect
          audio
          video={isVideoCall}
          data-lk-theme="default"
          className="flex min-h-0 flex-1 flex-col"
        >
          {isVideoCall ? (
            <VideoCallStage
              callRoom={payload.call_room}
              title={title}
              avatarUrl={avatarUrl}
              onLeave={onLeave}
              isLeaving={isLeaving}
            />
          ) : (
            <AudioCallStage
              callRoom={payload.call_room}
              title={title}
              avatarUrl={avatarUrl}
              onLeave={onLeave}
              isLeaving={isLeaving}
            />
          )}
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
  const requestedMediaType = searchParams.get("mediaType") === "video" ? "video" : "voice";
  const initialTitle = searchParams.get("title") ?? "";
  const initialAvatarUrl = searchParams.get("avatarUrl");
  const targetUserIdParam = searchParams.get("targetUserId");
  const targetUserId = targetUserIdParam && /^\d+$/.test(targetUserIdParam) ? Number(targetUserIdParam) : null;
  const isGroup = searchParams.get("isGroup") === "1";
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
  const [roomSnapshot, setRoomSnapshot] = useState<CallRoomApiItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const didInitializeRef = useRef(false);
  const didEndRef = useRef(false);
  const currentRoomUuid = payload?.call_room.room_uuid ?? roomUuid ?? activeConversationRoomUuid;
  const activeMediaType = payload?.call_room.media_type ?? roomSnapshot?.media_type ?? requestedMediaType;

  const closeWindow = useCallback(() => {
    window.close();

    window.setTimeout(() => {
      if (!window.closed) {
        window.location.replace(conversationId ? `/messages/t/${conversationId}` : "/messages");
      }
    }, 120);
  }, [conversationId]);

  const endCall = useCallback(async (reason = "left_from_call_popup", closeAfter = true) => {
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

    const canFastStart = Boolean(conversationId && (isGroup || targetUserId !== null));

    if (normalizedAction === "start" && !canFastStart && (!thread || !authUserId)) {
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
            setRoomSnapshot(activeCallRoom);

            if (!isCallTerminal(activeCallRoom)) {
              targetRoomUuid = activeCallRoom.room_uuid;

              if (participant && participant.invite_status !== "accepted") {
                const acceptedCallRoom = await apiClient
                  .post<CallRoomResponse>(`/api/calls/${targetRoomUuid}/accept`)
                  .then((response) => response.data);
                setRoomSnapshot(acceptedCallRoom);
              }
            }
          }

          if (!targetRoomUuid) {
            const callRoom =
              conversationId && (isGroup || targetUserId !== null)
                ? await startCallFast(conversationId, { isGroup, targetUserId, mediaType: requestedMediaType })
                : await startCall(thread as MessageThread, authUserId as number, requestedMediaType);
            setRoomSnapshot(callRoom);
            targetRoomUuid = callRoom.room_uuid;
          }
        } else if (normalizedAction === "accept") {
          const acceptedCallRoom = await apiClient
            .post<CallRoomResponse>(`/api/calls/${roomUuid}/accept`)
            .then((response) => response.data);
          setRoomSnapshot(acceptedCallRoom);
        }

        const joinPayload = await createJoinToken(targetRoomUuid, requestedMediaType === "video");
        setRoomSnapshot(joinPayload.call_room);
        setPayload(joinPayload);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error));
      } finally {
        setIsPreparing(false);
      }
    };

    void run();
  }, [action, activeConversationRoomUuid, authUserId, conversationId, isConversationError, isGroup, requestedMediaType, roomUuid, targetUserId, thread]);

  useEffect(() => {
    if (!currentRoomUuid) {
      return;
    }

    const activeRoomUuid = currentRoomUuid;

    const handleBeforeUnload = () => {
      if (didEndRef.current) {
        return;
      }

      didEndRef.current = true;
      publishPopupClosingSignal({
        roomUuid: activeRoomUuid,
        conversationId,
        reason: "call_popup_closed",
      });

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
          reason: "call_popup_closed",
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
  }, [conversationId, currentRoomUuid]);

  useEffect(() => {
    if (!authUserId || !currentRoomUuid) {
      return;
    }

    const echo = getEchoInstance();

    if (!echo) {
      return;
    }

    const handleStateChanged = (signal: CallSignalPayload) => {
      if (signal.call_room.room_uuid !== currentRoomUuid) {
        return;
      }

      setRoomSnapshot(signal.call_room);
      setPayload((current) =>
        current
          ? {
              ...current,
              call_room: signal.call_room,
            }
          : current,
      );

      if (isCallTerminal(signal.call_room)) {
        didEndRef.current = true;
        closeWindow();
      }
    };

    const userChannel = echo.private(`user.${authUserId}`);
    const conversationChannel = conversationId ? echo.private(`conversation.${conversationId}`) : null;

    userChannel.listen(".call.state.changed", handleStateChanged);
    conversationChannel?.listen(".call.state.changed", handleStateChanged);

    return () => {
      userChannel.stopListening(".call.state.changed", handleStateChanged);
      conversationChannel?.stopListening(".call.state.changed", handleStateChanged);
    };
  }, [authUserId, closeWindow, conversationId, currentRoomUuid]);

  useEffect(() => {
    if (!currentRoomUuid) {
      return;
    }

    let isCancelled = false;

    const syncRoomState = async () => {
      try {
        const latestCallRoom = await fetchCallRoom(currentRoomUuid);

        if (isCancelled) {
          return;
        }

        if (isCallTerminal(latestCallRoom)) {
          didEndRef.current = true;
          closeWindow();
          return;
        }

        setRoomSnapshot(latestCallRoom);

        setPayload((current) =>
          current
            ? {
                ...current,
                call_room: latestCallRoom,
              }
            : current,
        );
      } catch {
        // Ignore transient polling failures while the popup is open.
      }
    };

    void syncRoomState();

    const intervalId = window.setInterval(() => {
      void syncRoomState();
    }, 700);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [closeWindow, currentRoomUuid]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(93,108,255,0.14),transparent_30%),linear-gradient(180deg,#edf2ff_0%,#f8faff_100%)]">
      {payload ? (
        <AudioCallShell
          payload={payload}
          title={(thread?.name ?? initialTitle) || (activeMediaType === "video" ? "Video call" : "Voice call")}
          avatarUrl={thread?.avatarUrl ?? initialAvatarUrl ?? null}
          onLeave={() => {
            void endCall();
          }}
          isLeaving={isLeaving}
        />
      ) : (
        <div className="flex min-h-screen items-center justify-center px-5 py-6">
          <div className={`w-full rounded-[28px] border border-[rgba(111,123,176,0.14)] bg-white px-6 py-7 text-center shadow-[0_24px_70px_rgba(96,109,160,0.12)] ${activeMediaType === "video" ? "max-w-[560px]" : "max-w-[420px]"}`}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(96,91,255,0.08)] text-[var(--accent)]">
              {errorMessage ? (
                <X className="h-7 w-7" />
              ) : activeMediaType === "video" ? (
                <Video className="h-7 w-7" />
              ) : (
                <PhoneCall className="h-7 w-7" />
              )}
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#2f3655]">
              {errorMessage ? "Call unavailable" : `Preparing ${activeMediaType === "video" ? "video" : "audio"} call`}
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#7580a8]">
              {errorMessage ??
                `We are opening a separate ${activeMediaType === "video" ? "video" : "voice"} call window for this conversation.`}
            </p>

            {!errorMessage && roomSnapshot ? (
              <div className="mt-4 space-y-1 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  {getCallUiStatus(roomSnapshot)}
                </p>
                {roomSnapshot.status === "active" ? (
                  <p className="text-sm font-medium text-[#5f688f]">
                    Duration {formatCallDuration(roomSnapshot.duration_seconds ?? 0)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {isPreparing && !errorMessage ? (
              <div className="mx-auto mt-5 h-10 w-10 animate-spin rounded-full border-2 border-[rgba(111,123,176,0.16)] border-t-[var(--accent)]" />
            ) : null}

            {errorMessage ? (
              <div className="mt-6 flex items-center justify-center">
                <button
                  type="button"
                  onClick={closeWindow}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Close
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
