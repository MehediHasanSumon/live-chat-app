"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
} from "@livekit/components-react";
import { Camera, CameraOff, Lock, Mic, MicOff, MoreVertical, PhoneCall, PhoneOff, UserPlus, Video, X } from "lucide-react";
import { ConnectionState, Room, Track, type AudioCaptureOptions, type VideoCaptureOptions } from "livekit-client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CallDeviceSettingsModal } from "@/components/calls/call-device-check";
import { CallInviteManager } from "@/components/calls/call-invite-manager";
import { SpeakingParticipantTile } from "@/components/calls/call-livekit-feedback";
import { CallModeratorMuteListener } from "@/components/calls/call-moderator-mute-listener";
import { CallParticipantManager } from "@/components/calls/call-participant-manager";
import { MessageAvatar } from "@/components/messages/message-avatar";
import { ApiClientError, apiClient, ensureCsrfCookie } from "@/lib/api-client";
import {
  AUDIO_INPUT_PREFERENCE_KEY,
  AUDIO_OUTPUT_PREFERENCE_KEY,
  VIDEO_INPUT_PREFERENCE_KEY,
  buildCallDevicePayload,
  inspectCallDevices,
  readStoredDevicePreference,
  writeStoredDevicePreference,
} from "@/lib/call-device";
import {
  type CallSignalPayload,
  formatCallStatus,
  getCallParticipant,
  getDirectCallTargetUserId,
  isCallParticipantInactive,
  isCallTerminal,
  type CallRoomApiItem,
  type JoinCallApiPayload,
} from "@/lib/calls-data";
import { publishPopupClosingSignal } from "@/lib/call-popup-sync";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useConversationQuery } from "@/lib/hooks/use-conversation-query";
import { useUserPresenceQuery } from "@/lib/hooks/use-user-presence-query";
import { getDirectThreadPeer, toConversationThread, type MessageThread } from "@/lib/messages-data";
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

function resolveCallRoomUuid(...candidates: Array<string | null | undefined>): string {
  return candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0) ?? "";
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
  devicePayload: ReturnType<typeof buildCallDevicePayload>,
): Promise<CallRoomApiItem> {
  if (thread.isChatBlocked || thread.membership?.membership_state === "request_pending") {
    throw new Error("This conversation is not ready for calling yet.");
  }

  if (thread.isGroup) {
    return apiClient
      .post<CallRoomResponse>(`/api/conversations/${thread.id}/calls/group/${mediaType}`, devicePayload)
      .then((response) => response.data);
  }

  const targetUserId = getDirectCallTargetUserId(thread, authUserId);

  if (!targetUserId) {
    throw new Error("We could not identify the other participant for this call.");
  }

  return apiClient
    .post<CallRoomResponse>(`/api/calls/direct/${targetUserId}/${mediaType}`, devicePayload)
    .then((response) => response.data);
}

async function startCallFast(
  conversationId: string,
  options: {
    targetUserId?: number | null;
    isGroup?: boolean;
    mediaType: "voice" | "video";
  },
  devicePayload: ReturnType<typeof buildCallDevicePayload>,
): Promise<CallRoomApiItem> {
  if (options.isGroup) {
    return apiClient
      .post<CallRoomResponse>(`/api/conversations/${conversationId}/calls/group/${options.mediaType}`, devicePayload)
      .then((response) => response.data);
  }

  if (typeof options.targetUserId === "number") {
    return apiClient
      .post<CallRoomResponse>(`/api/calls/direct/${options.targetUserId}/${options.mediaType}`, devicePayload)
      .then((response) => response.data);
  }

  throw new Error("We could not identify the other participant for this call.");
}

async function createJoinToken(
  roomUuid: string,
  wantsVideo: boolean,
  devicePayload: ReturnType<typeof buildCallDevicePayload>,
) {
  return apiClient
    .post<JoinTokenResponse>(`/api/calls/${roomUuid}/join-token`, {
      wants_video: wantsVideo,
      ...devicePayload,
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
  onOpenSettings: () => void;
  onLeave: () => void;
  onEndForAll?: () => void;
  onToggleLock?: () => void;
  onMuteAll?: () => void;
  onRemoveParticipant?: (userId: number) => void;
  onInviteParticipant?: (userId: number) => void;
  isLeaving: boolean;
  isEndingForAll?: boolean;
  isTogglingLock?: boolean;
  isMutingAll?: boolean;
  showEndForAll: boolean;
  showLockControl: boolean;
  isRoomLocked: boolean;
  removingUserId?: number | null;
  invitingUserId?: number | null;
  authUserId: number | null;
  conversationMembers?: MessageThread["members"];
  audioOptions: AudioCaptureOptions;
  videoOptions?: VideoCaptureOptions;
  audioInputDeviceId?: string;
  audioOutputDeviceId?: string;
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

// Kept temporarily while the slimmer header rollout settles in.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CallWindowHeader({
  title,
  avatarUrl = null,
  statusLabel,
  durationLabel,
  onEndForAll,
  onToggleLock,
  onMuteAll,
  isEndingForAll = false,
  isTogglingLock = false,
  isMutingAll = false,
  showEndForAll,
  showLockControl,
  isRoomLocked,
}: {
  title: string;
  avatarUrl?: string | null;
  statusLabel: string;
  durationLabel: string | null;
  onEndForAll?: () => void;
  onToggleLock?: () => void;
  onMuteAll?: () => void;
  isEndingForAll?: boolean;
  isTogglingLock?: boolean;
  isMutingAll?: boolean;
  showEndForAll: boolean;
  showLockControl: boolean;
  isRoomLocked: boolean;
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

            {isRoomLocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/18 bg-amber-400/10 px-3 py-1.5 text-[11px] font-medium text-amber-50 backdrop-blur">
                <Lock className="h-3.5 w-3.5" />
                Locked
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showLockControl ? (
          <button
            type="button"
            onClick={onMuteAll}
            disabled={isMutingAll}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3.5 py-2 text-sm font-medium text-white/88 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MicOff className="h-4 w-4" />
            {isMutingAll ? "Muting..." : "Mute all"}
          </button>
        ) : null}

        {showLockControl ? (
          <button
            type="button"
            onClick={onToggleLock}
            disabled={isTogglingLock}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3.5 py-2 text-sm font-medium text-white/88 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Lock className="h-4 w-4" />
            {isTogglingLock ? "Updating..." : isRoomLocked ? "Unlock" : "Lock"}
          </button>
        ) : null}

        {showEndForAll ? (
          <button
            type="button"
            onClick={onEndForAll}
            disabled={isEndingForAll}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/28 bg-amber-500/12 px-3.5 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            End for all
          </button>
        ) : null}
      </div>
    </header>
  );
}

function CallPopupControls({
  isVideoCall,
  audioOptions,
  videoOptions,
  onLeave,
  onEndForAll,
  isLeaving,
  isEndingForAll = false,
  showEndForAll,
}: {
  isVideoCall: boolean;
  audioOptions?: AudioCaptureOptions;
  videoOptions?: VideoCaptureOptions;
  onLeave: () => void;
  onEndForAll?: () => void;
  isLeaving: boolean;
  isEndingForAll?: boolean;
  showEndForAll: boolean;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-6">
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[rgba(12,16,31,0.84)] px-4 py-3 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => {
            void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled, isMicrophoneEnabled ? undefined : audioOptions);
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
              void localParticipant.setCameraEnabled(!isCameraEnabled, isCameraEnabled ? undefined : videoOptions);
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

        {showEndForAll ? (
          <button
            type="button"
            onClick={onEndForAll}
            disabled={isEndingForAll}
            aria-label={isEndingForAll ? "Ending call for everyone" : "End call for everyone"}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/14 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4.5 w-4.5" />
            End all
          </button>
        ) : null}

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

function SlimCallWindowHeader({
  title,
  avatarUrl = null,
  subtitle,
  onOpenSettings,
}: {
  title: string;
  avatarUrl?: string | null;
  subtitle: string;
  onOpenSettings: () => void;
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
          <p className="mt-1 text-sm text-white/62">{subtitle}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Open call settings"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/84 transition hover:bg-white/12"
      >
        <MoreVertical className="h-4.5 w-4.5" />
      </button>
    </header>
  );
}

function CallManagementStrip({
  onToggleLock,
  onMuteAll,
  isTogglingLock = false,
  isMutingAll = false,
  showLockControl,
  isRoomLocked,
}: {
  onToggleLock?: () => void;
  onMuteAll?: () => void;
  isTogglingLock?: boolean;
  isMutingAll?: boolean;
  showLockControl: boolean;
  isRoomLocked: boolean;
}) {
  if (!showLockControl) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2 px-4 md:px-5">
      <button
        type="button"
        onClick={onMuteAll}
        disabled={isMutingAll}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3.5 py-2 text-sm font-medium text-white/88 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <MicOff className="h-4 w-4" />
        {isMutingAll ? "Muting..." : "Mute all"}
      </button>

      <button
        type="button"
        onClick={onToggleLock}
        disabled={isTogglingLock}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3.5 py-2 text-sm font-medium text-white/88 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isTogglingLock ? "Updating..." : isRoomLocked ? "Unlock room" : "Lock room"}
      </button>
    </div>
  );
}

function PendingCallControls({
  onLeave,
  isLeaving,
}: {
  onLeave: () => void;
  isLeaving: boolean;
}) {
  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-6">
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[rgba(12,16,31,0.84)] px-4 py-3 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <button
          type="button"
          disabled
          aria-label="Microphone will turn on when the call connects"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/6 text-white/34 opacity-70"
        >
          <Mic className="h-4.5 w-4.5" />
        </button>

        <button
          type="button"
          disabled
          aria-label="Participant controls are unavailable until the call connects"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/6 text-white/34 opacity-70"
        >
          <UserPlus className="h-4.5 w-4.5" />
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
    </div>
  );
}

function PendingCallShell({
  title,
  avatarUrl = null,
  statusLabel,
  subtitle,
  onOpenSettings,
  onLeave,
  isLeaving,
}: {
  title: string;
  avatarUrl?: string | null;
  statusLabel: string;
  subtitle: string;
  onOpenSettings: () => void;
  onLeave: () => void;
  isLeaving: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,189,141,0.14),transparent_18%),radial-gradient(circle_at_bottom,rgba(51,87,124,0.22),transparent_28%),linear-gradient(180deg,#141927_0%,#0e1320_100%)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-[12%] top-[12%] h-[34%] rounded-full bg-[radial-gradient(circle,rgba(165,108,86,0.42)_0%,rgba(165,108,86,0)_72%)] blur-3xl" />
        <div className="absolute inset-x-[10%] bottom-[8%] h-[38%] rounded-full bg-[radial-gradient(circle,rgba(42,68,96,0.42)_0%,rgba(42,68,96,0)_72%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_22%,rgba(8,10,16,0.2)_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[460px] flex-col">
        <SlimCallWindowHeader
          title={title}
          avatarUrl={avatarUrl}
          subtitle={subtitle}
          onOpenSettings={onOpenSettings}
        />

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
          <p className="mt-2 text-sm font-medium text-white/70">{subtitle}</p>
        </div>

        <PendingCallControls onLeave={onLeave} isLeaving={isLeaving} />
      </div>
    </div>
  );
}

function AudioCallStage({
  callRoom,
  title,
  avatarUrl = null,
  onOpenSettings,
  onLeave,
  onEndForAll,
  onToggleLock,
  onMuteAll,
  onRemoveParticipant,
  onInviteParticipant,
  isLeaving,
  isEndingForAll = false,
  isTogglingLock = false,
  isMutingAll = false,
  showEndForAll,
  showLockControl,
  isRoomLocked,
  audioOptions,
  videoOptions,
  removingUserId = null,
  invitingUserId = null,
  authUserId,
  conversationMembers,
}: {
  callRoom: CallRoomApiItem;
  title: string;
  avatarUrl?: string | null;
  onOpenSettings: () => void;
  onLeave: () => void;
  onEndForAll?: () => void;
  onToggleLock?: () => void;
  onMuteAll?: () => void;
  onRemoveParticipant?: (userId: number) => void;
  onInviteParticipant?: (userId: number) => void;
  isLeaving: boolean;
  isEndingForAll?: boolean;
  isTogglingLock?: boolean;
  isMutingAll?: boolean;
  showEndForAll: boolean;
  showLockControl: boolean;
  isRoomLocked: boolean;
  audioOptions: AudioCaptureOptions;
  videoOptions?: VideoCaptureOptions;
  removingUserId?: number | null;
  invitingUserId?: number | null;
  authUserId: number | null;
  conversationMembers?: MessageThread["members"];
}) {
  const { statusLabel, durationLabel } = useCallStageMeta(callRoom);

  return (
    <>
      <RoomAudioRenderer />
      <SlimCallWindowHeader
        title={title}
        avatarUrl={avatarUrl}
        subtitle={durationLabel ? `${statusLabel} · ${durationLabel}` : statusLabel}
        onOpenSettings={onOpenSettings}
      />

      <CallManagementStrip
        onToggleLock={onToggleLock}
        onMuteAll={onMuteAll}
        isTogglingLock={isTogglingLock}
        isMutingAll={isMutingAll}
        showLockControl={showLockControl}
        isRoomLocked={isRoomLocked}
      />

      {showLockControl && callRoom.scope === "group" && callRoom.participants ? (
        <div className="px-4 md:px-5">
          <CallParticipantManager
            participants={callRoom.participants}
            authUserId={authUserId}
            createdBy={callRoom.created_by}
            removingUserId={removingUserId}
            onRemoveParticipant={onRemoveParticipant}
          />
          {conversationMembers ? (
            <CallInviteManager
              members={conversationMembers}
              callRoom={callRoom}
              authUserId={authUserId}
              invitingUserId={invitingUserId}
              onInviteUser={onInviteParticipant}
            />
          ) : null}
        </div>
      ) : null}

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

      <CallPopupControls
        isVideoCall={false}
        audioOptions={audioOptions}
        videoOptions={videoOptions}
        onLeave={onLeave}
        onEndForAll={onEndForAll}
        isLeaving={isLeaving}
        isEndingForAll={isEndingForAll}
        showEndForAll={showEndForAll}
      />
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
            <SpeakingParticipantTile trackRef={trackRef} />
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
  onOpenSettings,
  onLeave,
  onEndForAll,
  onToggleLock,
  onMuteAll,
  onRemoveParticipant,
  onInviteParticipant,
  isLeaving,
  isEndingForAll = false,
  isTogglingLock = false,
  isMutingAll = false,
  showEndForAll,
  showLockControl,
  isRoomLocked,
  showCameraControls,
  audioOptions,
  videoOptions,
  removingUserId = null,
  invitingUserId = null,
  authUserId,
  conversationMembers,
}: {
  callRoom: CallRoomApiItem;
  title: string;
  avatarUrl?: string | null;
  onOpenSettings: () => void;
  onLeave: () => void;
  onEndForAll?: () => void;
  onToggleLock?: () => void;
  onMuteAll?: () => void;
  onRemoveParticipant?: (userId: number) => void;
  onInviteParticipant?: (userId: number) => void;
  isLeaving: boolean;
  isEndingForAll?: boolean;
  isTogglingLock?: boolean;
  isMutingAll?: boolean;
  showEndForAll: boolean;
  showLockControl: boolean;
  isRoomLocked: boolean;
  showCameraControls: boolean;
  audioOptions: AudioCaptureOptions;
  videoOptions?: VideoCaptureOptions;
  removingUserId?: number | null;
  invitingUserId?: number | null;
  authUserId: number | null;
  conversationMembers?: MessageThread["members"];
}) {
  const { statusLabel, durationLabel } = useCallStageMeta(callRoom);

  return (
    <>
      <RoomAudioRenderer />
      <SlimCallWindowHeader
        title={title}
        avatarUrl={avatarUrl}
        subtitle={durationLabel ? `${statusLabel} · ${durationLabel}` : statusLabel}
        onOpenSettings={onOpenSettings}
      />

      <CallManagementStrip
        onToggleLock={onToggleLock}
        onMuteAll={onMuteAll}
        isTogglingLock={isTogglingLock}
        isMutingAll={isMutingAll}
        showLockControl={showLockControl}
        isRoomLocked={isRoomLocked}
      />

      {showLockControl && callRoom.scope === "group" && callRoom.participants ? (
        <div className="px-4 md:px-5">
          <CallParticipantManager
            participants={callRoom.participants}
            authUserId={authUserId}
            createdBy={callRoom.created_by}
            removingUserId={removingUserId}
            onRemoveParticipant={onRemoveParticipant}
          />
          {conversationMembers ? (
            <CallInviteManager
              members={conversationMembers}
              callRoom={callRoom}
              authUserId={authUserId}
              invitingUserId={invitingUserId}
              onInviteUser={onInviteParticipant}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 px-4 pb-24 pt-2 md:px-5">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-[34px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,29,0.92)_0%,rgba(8,12,22,0.94)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_32px_90px_rgba(0,0,0,0.34)]">
          <VideoParticipantGrid />
        </div>
      </div>

      <CallPopupControls
        isVideoCall={showCameraControls}
        audioOptions={audioOptions}
        videoOptions={videoOptions}
        onLeave={onLeave}
        onEndForAll={onEndForAll}
        isLeaving={isLeaving}
        isEndingForAll={isEndingForAll}
        showEndForAll={showEndForAll}
      />
    </>
  );
}

function AudioCallShell({
  payload,
  title,
  avatarUrl = null,
  onOpenSettings,
  onLeave,
  onEndForAll,
  onToggleLock,
  onMuteAll,
  onRemoveParticipant,
  onInviteParticipant,
  isLeaving,
  isEndingForAll = false,
  isTogglingLock = false,
  isMutingAll = false,
  showEndForAll,
  showLockControl,
  isRoomLocked,
  removingUserId = null,
  invitingUserId = null,
  authUserId,
  conversationMembers,
  audioOptions,
  videoOptions,
  audioInputDeviceId,
  audioOutputDeviceId,
}: AudioCallShellProps) {
  const isVideoCall = payload.call_room.media_type === "video";
  const canPublishVideo = isVideoCall && payload.publish_mode === "video";
  const room = useMemo(() => new Room(), []);

  useEffect(() => {
    if (!audioInputDeviceId) {
      return;
    }

    void room.switchActiveDevice("audioinput", audioInputDeviceId).catch(() => {
      // Ignore browsers that do not support live microphone switching.
    });
  }, [audioInputDeviceId, room]);

  useEffect(() => {
    if (!audioOutputDeviceId) {
      return;
    }

    void room.switchActiveDevice("audiooutput", audioOutputDeviceId).catch(() => {
      // Ignore browsers that do not support audio output switching.
    });
  }, [audioOutputDeviceId, room]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,189,141,0.14),transparent_18%),radial-gradient(circle_at_bottom,rgba(51,87,124,0.22),transparent_28%),linear-gradient(180deg,#141927_0%,#0e1320_100%)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-[12%] top-[12%] h-[34%] rounded-full bg-[radial-gradient(circle,rgba(165,108,86,0.42)_0%,rgba(165,108,86,0)_72%)] blur-3xl" />
        <div className="absolute inset-x-[10%] bottom-[8%] h-[38%] rounded-full bg-[radial-gradient(circle,rgba(42,68,96,0.42)_0%,rgba(42,68,96,0)_72%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_22%,rgba(8,10,16,0.2)_100%)]" />
      </div>

      <div className={`relative mx-auto flex min-h-screen w-full flex-col ${isVideoCall ? "max-w-[1280px]" : "max-w-[460px]"}`}>
        <LiveKitRoom
          room={room}
          token={payload.token.token}
          serverUrl={normalizeLiveKitServerUrl(payload.token.url)}
          connect
          audio={audioOptions}
          video={canPublishVideo ? videoOptions || true : false}
          data-lk-theme="default"
          className="flex min-h-0 flex-1 flex-col"
        >
          <CallModeratorMuteListener roomUuid={payload.call_room.room_uuid} authUserId={authUserId} />
          {isVideoCall ? (
            <VideoCallStage
              callRoom={payload.call_room}
              title={title}
              avatarUrl={avatarUrl}
              onOpenSettings={onOpenSettings}
              onLeave={onLeave}
              onEndForAll={onEndForAll}
              onToggleLock={onToggleLock}
              onMuteAll={onMuteAll}
              onRemoveParticipant={onRemoveParticipant}
              onInviteParticipant={onInviteParticipant}
              isLeaving={isLeaving}
              isEndingForAll={isEndingForAll}
              isTogglingLock={isTogglingLock}
              isMutingAll={isMutingAll}
              showEndForAll={showEndForAll}
              showLockControl={showLockControl}
              isRoomLocked={isRoomLocked}
              showCameraControls={canPublishVideo}
              audioOptions={audioOptions}
              videoOptions={videoOptions}
              removingUserId={removingUserId}
              invitingUserId={invitingUserId}
              authUserId={authUserId}
              conversationMembers={conversationMembers}
            />
          ) : (
            <AudioCallStage
              callRoom={payload.call_room}
              title={title}
              avatarUrl={avatarUrl}
              onOpenSettings={onOpenSettings}
              onLeave={onLeave}
              onEndForAll={onEndForAll}
              onToggleLock={onToggleLock}
              onMuteAll={onMuteAll}
              onRemoveParticipant={onRemoveParticipant}
              onInviteParticipant={onInviteParticipant}
              isLeaving={isLeaving}
              isEndingForAll={isEndingForAll}
              isTogglingLock={isTogglingLock}
              isMutingAll={isMutingAll}
              showEndForAll={showEndForAll}
              showLockControl={showLockControl}
              isRoomLocked={isRoomLocked}
              audioOptions={audioOptions}
              videoOptions={videoOptions}
              removingUserId={removingUserId}
              invitingUserId={invitingUserId}
              authUserId={authUserId}
              conversationMembers={conversationMembers}
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
  const directPeer = useMemo(() => (thread ? getDirectThreadPeer(thread) : null), [thread]);
  const { data: directPeerPresence } = useUserPresenceQuery(
    directPeer?.user_id,
    Boolean(directPeer?.user_id) && !Boolean(thread?.isGroup),
  );
  const [payload, setPayload] = useState<JoinCallApiPayload | null>(null);
  const [roomSnapshot, setRoomSnapshot] = useState<CallRoomApiItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [isMutingAll, setIsMutingAll] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);
  const selectedMediaType = requestedMediaType;
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState<string>(() => readStoredDevicePreference(AUDIO_INPUT_PREFERENCE_KEY));
  const [selectedVideoInputId, setSelectedVideoInputId] = useState<string>(() => readStoredDevicePreference(VIDEO_INPUT_PREFERENCE_KEY));
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string>(() => readStoredDevicePreference(AUDIO_OUTPUT_PREFERENCE_KEY));
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(requestedMediaType !== "video");
  const [deviceCheckMessage, setDeviceCheckMessage] = useState<string | null>(null);
  const [isCheckingDevices, setIsCheckingDevices] = useState(true);
  const [isDeviceCheckComplete, setIsDeviceCheckComplete] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const didInitializeRef = useRef(false);
  const didEndRef = useRef(false);
  const currentRoomUuid = resolveCallRoomUuid(
    payload?.call_room.room_uuid,
    roomSnapshot?.room_uuid,
    roomUuid,
    activeConversationRoomUuid,
  );
  const activeMediaType = payload?.call_room.media_type ?? roomSnapshot?.media_type ?? selectedMediaType;
  const canManageRoomControls =
    authUserId !== null &&
    (payload?.call_room.scope ?? roomSnapshot?.scope) === "group" &&
    (
      (payload?.call_room.created_by ?? roomSnapshot?.created_by) === authUserId ||
      ["owner", "admin"].includes(thread?.membership?.role ?? "")
    );
  const showEndForAll = canManageRoomControls;
  const showLockControl = canManageRoomControls;
  const isRoomLocked = payload?.call_room.is_locked ?? roomSnapshot?.is_locked ?? false;
  const devicePayload = useMemo(
    () =>
      microphoneReady && selectedAudioInputId
        ? buildCallDevicePayload({
            selectedAudioInputId,
            selectedAudioOutputId,
          })
        : null,
    [microphoneReady, selectedAudioInputId, selectedAudioOutputId],
  );
  const audioOptions = useMemo<AudioCaptureOptions>(() => ({
    echoCancellation: true,
    noiseSuppression: true,
    ...(selectedAudioInputId ? { deviceId: { exact: selectedAudioInputId } } : {}),
  }), [selectedAudioInputId]);
  const videoOptions = useMemo<VideoCaptureOptions | undefined>(() => {
    if (selectedMediaType !== "video") {
      return undefined;
    }

    return {
      ...(selectedVideoInputId ? { deviceId: { exact: selectedVideoInputId } } : {}),
      frameRate: 15,
    };
  }, [selectedMediaType, selectedVideoInputId]);

  const runDeviceCheck = useCallback(async (mediaType: "voice" | "video" = selectedMediaType) => {
    setIsCheckingDevices(true);
    try {
      const snapshot = await inspectCallDevices({
        requestedMediaType: mediaType,
        preferredAudioInputId: selectedAudioInputId,
        preferredAudioOutputId: selectedAudioOutputId,
        preferredVideoInputId: selectedVideoInputId,
      });

      setAudioInputDevices(snapshot.audioInputs);
      setAudioOutputDevices(snapshot.audioOutputs);
      setSelectedAudioInputId(snapshot.selectedAudioInputId);
      setSelectedVideoInputId(snapshot.selectedVideoInputId);
      setSelectedAudioOutputId(snapshot.selectedAudioOutputId);
      setMicrophoneReady(snapshot.microphoneReady);
      setCameraReady(snapshot.cameraReady);
      setDeviceCheckMessage(snapshot.detailMessage);
      setErrorMessage((current) =>
        current && !snapshot.microphoneReady
          ? (snapshot.detailMessage ?? "No default microphone is available for this call.")
          : current,
      );
    } finally {
      setIsCheckingDevices(false);
      setIsDeviceCheckComplete(true);
    }
  }, [selectedAudioInputId, selectedAudioOutputId, selectedMediaType, selectedVideoInputId]);

  const closeWindow = useCallback(() => {
    window.close();

    window.setTimeout(() => {
      if (!window.closed) {
        window.location.replace(conversationId ? `/messages/t/${conversationId}` : "/messages");
      }
    }, 120);
  }, [conversationId]);

  useEffect(() => {
    void runDeviceCheck(selectedMediaType);
  }, [runDeviceCheck, selectedMediaType]);

  useEffect(() => {
    writeStoredDevicePreference(AUDIO_INPUT_PREFERENCE_KEY, selectedAudioInputId);
  }, [selectedAudioInputId]);

  useEffect(() => {
    writeStoredDevicePreference(VIDEO_INPUT_PREFERENCE_KEY, selectedVideoInputId);
  }, [selectedVideoInputId]);

  useEffect(() => {
    writeStoredDevicePreference(AUDIO_OUTPUT_PREFERENCE_KEY, selectedAudioOutputId);
  }, [selectedAudioOutputId]);

  const endCall = useCallback(async (reason = "left_from_call_popup", closeAfter = true) => {
    const activeRoomUuid = resolveCallRoomUuid(
      payload?.call_room.room_uuid,
      roomSnapshot?.room_uuid,
      roomUuid,
      activeConversationRoomUuid,
    );

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
  }, [activeConversationRoomUuid, closeWindow, payload?.call_room.room_uuid, roomSnapshot?.room_uuid, roomUuid]);

  const endCallForAll = useCallback(async (reason = "ended_from_call_popup", closeAfter = true) => {
    const activeRoomUuid = resolveCallRoomUuid(
      payload?.call_room.room_uuid,
      roomSnapshot?.room_uuid,
      roomUuid,
      activeConversationRoomUuid,
    );

    if (!activeRoomUuid || didEndRef.current) {
      if (closeAfter) {
        closeWindow();
      }

      return;
    }

    didEndRef.current = true;
    setIsLeaving(true);

    try {
      await apiClient.post(`/api/calls/${activeRoomUuid}/end-for-all`, {
        reason,
      });
    } catch {
      didEndRef.current = false;
    } finally {
      setIsLeaving(false);

      if (closeAfter && didEndRef.current) {
        closeWindow();
      }
    }
  }, [activeConversationRoomUuid, closeWindow, payload?.call_room.room_uuid, roomSnapshot?.room_uuid, roomUuid]);

  const toggleRoomLock = useCallback(async (nextLocked: boolean) => {
    const activeRoomUuid = resolveCallRoomUuid(
      payload?.call_room.room_uuid,
      roomSnapshot?.room_uuid,
      roomUuid,
      activeConversationRoomUuid,
    );

    if (!activeRoomUuid) {
      return;
    }

    setIsTogglingLock(true);

    try {
      const updatedCallRoom = await apiClient
        .post<CallRoomResponse>(`/api/calls/${activeRoomUuid}/${nextLocked ? "lock" : "unlock"}`)
        .then((response) => response.data);

      setRoomSnapshot(updatedCallRoom);
      setPayload((current) =>
        current
          ? {
              ...current,
              call_room: updatedCallRoom,
            }
          : current,
      );
    } finally {
      setIsTogglingLock(false);
    }
  }, [activeConversationRoomUuid, payload?.call_room.room_uuid, roomSnapshot?.room_uuid, roomUuid]);

  const removeParticipant = useCallback(async (targetUserId: number) => {
    const activeRoomUuid = resolveCallRoomUuid(
      payload?.call_room.room_uuid,
      roomSnapshot?.room_uuid,
      roomUuid,
      activeConversationRoomUuid,
    );

    if (!activeRoomUuid) {
      return;
    }

    setRemovingUserId(targetUserId);

    try {
      const updatedCallRoom = await apiClient
        .post<CallRoomResponse>(`/api/calls/${activeRoomUuid}/participants/${targetUserId}/remove`, {
          reason: "removed_from_call_popup",
        })
        .then((response) => response.data);

      setRoomSnapshot(updatedCallRoom);
      setPayload((current) =>
        current
          ? {
              ...current,
              call_room: updatedCallRoom,
            }
          : current,
      );
    } finally {
      setRemovingUserId((current) => (current === targetUserId ? null : current));
    }
  }, [activeConversationRoomUuid, payload?.call_room.room_uuid, roomSnapshot?.room_uuid, roomUuid]);

  const muteAllParticipants = useCallback(async () => {
    const activeRoomUuid = resolveCallRoomUuid(
      payload?.call_room.room_uuid,
      roomSnapshot?.room_uuid,
      roomUuid,
      activeConversationRoomUuid,
    );

    if (!activeRoomUuid) {
      return;
    }

    setIsMutingAll(true);

    try {
      await apiClient.post<CallRoomResponse>(`/api/calls/${activeRoomUuid}/mute-all`);
    } finally {
      setIsMutingAll(false);
    }
  }, [activeConversationRoomUuid, payload?.call_room.room_uuid, roomSnapshot?.room_uuid, roomUuid]);

  const inviteParticipant = useCallback(async (targetUserId: number) => {
    const activeRoomUuid = resolveCallRoomUuid(
      payload?.call_room.room_uuid,
      roomSnapshot?.room_uuid,
      roomUuid,
      activeConversationRoomUuid,
    );

    if (!activeRoomUuid) {
      return;
    }

    setInvitingUserId(targetUserId);

    try {
      const updatedCallRoom = await apiClient
        .post<CallRoomResponse>(`/api/calls/${activeRoomUuid}/invite`, {
          user_ids: [targetUserId],
        })
        .then((response) => response.data);

      setRoomSnapshot(updatedCallRoom);
      setPayload((current) =>
        current
          ? {
              ...current,
              call_room: updatedCallRoom,
            }
          : current,
      );
    } finally {
      setInvitingUserId((current) => (current === targetUserId ? null : current));
    }
  }, [activeConversationRoomUuid, payload?.call_room.room_uuid, roomSnapshot?.room_uuid, roomUuid]);

  useEffect(() => {
    if (!isDeviceCheckComplete) {
      return;
    }

    if (didInitializeRef.current) {
      return;
    }

    const normalizedAction = action === "accept" || action === "join" ? action : "start";

    if (!conversationId) {
      setErrorMessage("We could not resolve this conversation.");
      setIsPreparing(false);
      return;
    }

    if (!devicePayload) {
      setErrorMessage(deviceCheckMessage ?? "No default microphone is available for this call.");
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
    setErrorMessage(null);
    setIsPreparing(true);

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
                  .post<CallRoomResponse>(`/api/calls/${targetRoomUuid}/accept`, devicePayload)
                  .then((response) => response.data);
                setRoomSnapshot(acceptedCallRoom);
              }
            }
          }

          if (!targetRoomUuid) {
            const callRoom =
              conversationId && (isGroup || targetUserId !== null)
                ? await startCallFast(conversationId, { isGroup, targetUserId, mediaType: selectedMediaType }, devicePayload)
                : await startCall(thread as MessageThread, authUserId as number, selectedMediaType, devicePayload);
            setRoomSnapshot(callRoom);
            targetRoomUuid = callRoom.room_uuid;
          }
        } else if (normalizedAction === "accept") {
          const acceptedCallRoom = await apiClient
            .post<CallRoomResponse>(`/api/calls/${roomUuid}/accept`, devicePayload)
            .then((response) => response.data);
          setRoomSnapshot(acceptedCallRoom);
        }

        const joinPayload = await createJoinToken(targetRoomUuid, selectedMediaType === "video" && cameraReady, devicePayload);
        setRoomSnapshot(joinPayload.call_room);
        setPayload(joinPayload);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error));
      } finally {
        setIsPreparing(false);
      }
    };

    void run();
  }, [action, activeConversationRoomUuid, authUserId, cameraReady, conversationId, deviceCheckMessage, devicePayload, isConversationError, isDeviceCheckComplete, isGroup, roomUuid, selectedMediaType, targetUserId, thread]);

  useEffect(() => {
    if (!currentRoomUuid) {
      return;
    }

    const activeRoomUuid = currentRoomUuid;

    const handleBeforeUnload = () => {
      if (didEndRef.current) {
        return;
      }

      publishPopupClosingSignal({
        roomUuid: activeRoomUuid,
        conversationId,
        reason: "call_popup_closed",
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

      const viewerParticipant = getCallParticipant(signal.call_room, authUserId);

      setRoomSnapshot(signal.call_room);
      setPayload((current) =>
        current
          ? {
              ...current,
              call_room: signal.call_room,
            }
          : current,
      );

      if (isCallTerminal(signal.call_room) || isCallParticipantInactive(viewerParticipant)) {
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

        const viewerParticipant = getCallParticipant(latestCallRoom, authUserId);

        if (isCallTerminal(latestCallRoom) || isCallParticipantInactive(viewerParticipant)) {
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
  }, [authUserId, closeWindow, currentRoomUuid]);

  const pendingStatusLabel = useMemo(() => {
    if (roomSnapshot) {
      return roomSnapshot.status === "active" ? "Connecting" : getCallUiStatus(roomSnapshot);
    }

    if (action === "accept" || action === "join") {
      return "Connecting";
    }

    return directPeerPresence?.visible && directPeerPresence.is_online ? "Ringing" : "Calling";
  }, [action, directPeerPresence, roomSnapshot]);

  const pendingSubtitle = useMemo(() => {
    if (errorMessage) {
      return errorMessage;
    }

    if (pendingStatusLabel === "Ringing") {
      return "Receiver is online. Waiting for answer.";
    }

    if (pendingStatusLabel === "Calling") {
      return "Trying to reach the receiver.";
    }

    return isPreparing ? "Joining the call with your default devices." : "Connecting your call.";
  }, [errorMessage, isPreparing, pendingStatusLabel]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(93,108,255,0.14),transparent_30%),linear-gradient(180deg,#edf2ff_0%,#f8faff_100%)]">
      {payload ? (
        <AudioCallShell
          payload={payload}
          title={(thread?.name ?? initialTitle) || (activeMediaType === "video" ? "Video call" : "Voice call")}
          avatarUrl={thread?.avatarUrl ?? initialAvatarUrl ?? null}
          onOpenSettings={() => {
            setIsSettingsOpen(true);
          }}
          onLeave={() => {
            void endCall();
          }}
          onEndForAll={
            showEndForAll
              ? () => {
                  void endCallForAll();
                }
              : undefined
          }
          onToggleLock={
            showLockControl
              ? () => {
                  void toggleRoomLock(!isRoomLocked);
                }
              : undefined
          }
          onMuteAll={
            showLockControl
              ? () => {
                  void muteAllParticipants();
                }
              : undefined
          }
          onRemoveParticipant={
            showLockControl
              ? (userId) => {
                  void removeParticipant(userId);
                }
              : undefined
          }
          onInviteParticipant={
            showLockControl
              ? (userId) => {
                  void inviteParticipant(userId);
                }
              : undefined
          }
          isLeaving={isLeaving}
          isEndingForAll={isLeaving}
          isTogglingLock={isTogglingLock}
          isMutingAll={isMutingAll}
          showEndForAll={showEndForAll}
          showLockControl={showLockControl}
          isRoomLocked={isRoomLocked}
          removingUserId={removingUserId}
          invitingUserId={invitingUserId}
          authUserId={authUserId}
          conversationMembers={thread?.members}
          audioOptions={audioOptions}
          videoOptions={videoOptions}
          audioInputDeviceId={selectedAudioInputId}
          audioOutputDeviceId={selectedAudioOutputId}
        />
      ) : errorMessage ? (
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
      ) : (
        <PendingCallShell
          title={(thread?.name ?? initialTitle) || (activeMediaType === "video" ? "Video call" : "Voice call")}
          avatarUrl={thread?.avatarUrl ?? initialAvatarUrl ?? null}
          statusLabel={pendingStatusLabel}
          subtitle={pendingSubtitle}
          onOpenSettings={() => {
            setIsSettingsOpen(true);
          }}
          onLeave={() => {
            void endCall("cancelled_from_pending_popup");
          }}
          isLeaving={isLeaving}
        />
      )}

      <CallDeviceSettingsModal
        isOpen={isSettingsOpen}
        title={(thread?.name ?? initialTitle) || "This conversation"}
        isChecking={isCheckingDevices}
        microphoneReady={microphoneReady}
        detailMessage={deviceCheckMessage}
        audioInputs={audioInputDevices}
        audioOutputs={audioOutputDevices}
        selectedAudioInputId={selectedAudioInputId}
        selectedAudioOutputId={selectedAudioOutputId}
        onSelectAudioInput={setSelectedAudioInputId}
        onSelectAudioOutput={setSelectedAudioOutputId}
        onRefresh={() => {
          void runDeviceCheck(selectedMediaType);
        }}
        onClose={() => {
          setIsSettingsOpen(false);
        }}
      />
    </main>
  );
}
