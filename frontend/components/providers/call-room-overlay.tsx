"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react";
import { Camera, CameraOff, Lock, Mic, MicOff, Minimize2, PhoneOff, Video, X } from "lucide-react";
import { Track } from "livekit-client";
import { useShallow } from "zustand/react/shallow";

import { CallParticipantManager } from "@/components/calls/call-participant-manager";
import { CallLiveKitFeedback, SpeakingParticipantTile } from "@/components/calls/call-livekit-feedback";
import { CallModeratorMuteListener } from "@/components/calls/call-moderator-mute-listener";
import { CallInviteManager } from "@/components/calls/call-invite-manager";
import {
  formatCallStatus,
  getCallLabel,
  type JoinCallApiPayload,
} from "@/lib/calls-data";
import {
  useEndCallForAllMutation,
  useEndCallMutation,
  useInviteCallParticipantsMutation,
  useLockCallRoomMutation,
  useMuteAllCallParticipantsMutation,
  useRemoveCallParticipantMutation,
  useUnlockCallRoomMutation,
} from "@/lib/hooks/use-call-mutations";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { toConversationThread } from "@/lib/messages-data";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCallStore } from "@/lib/stores/call-store";

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

function CallParticipantGrid() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });

  return (
    <div className={`grid h-full w-full auto-rows-fr grid-cols-1 gap-3 overflow-auto p-0 ${tracks.length > 2 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2"}`}>
      {tracks.map((trackRef) => {
        const key = `${trackRef.participant.identity}-${trackRef.source}`;

        return (
          <div
            key={key}
            className="h-full min-h-0 w-full overflow-hidden rounded-[30px] border border-white/8 bg-black"
          >
            <SpeakingParticipantTile trackRef={trackRef} />
          </div>
        );
      })}
    </div>
  );
}

function OverlayCallControls({
  showCameraControls,
  onLeave,
  onEndForAll,
  isLeaving,
  isEndingForAll,
  showEndForAll,
}: {
  showCameraControls: boolean;
  onLeave: () => void;
  onEndForAll?: () => void;
  isLeaving: boolean;
  isEndingForAll?: boolean;
  showEndForAll: boolean;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-6">
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[rgba(12,16,31,0.84)] px-4 py-3 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => {
            void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/14"
          aria-label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {isMicrophoneEnabled ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}
        </button>

        {showCameraControls ? (
          <button
            type="button"
            onClick={() => {
              void localParticipant.setCameraEnabled(!isCameraEnabled);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/14"
            aria-label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
          >
            {isCameraEnabled ? <Camera className="h-4.5 w-4.5" /> : <CameraOff className="h-4.5 w-4.5" />}
          </button>
        ) : null}

        {showEndForAll ? (
          <button
            type="button"
            onClick={onEndForAll}
            disabled={isEndingForAll}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/14 px-4 py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            End all
          </button>
        ) : null}

        <button
          type="button"
          onClick={onLeave}
          disabled={isLeaving}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff6683_0%,#ff4b6e_100%)] text-white shadow-[0_16px_30px_rgba(255,75,110,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={isLeaving ? "Leaving call" : "Leave call"}
        >
          <PhoneOff className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}

type LiveKitCallPanelProps = {
  payload: JoinCallApiPayload;
  onMinimize: () => void;
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
  conversationMembers?: ReturnType<typeof toConversationThread>["members"];
};

function LiveKitCallPanel({
  payload,
  onMinimize,
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
}: LiveKitCallPanelProps) {
  const showCameraControls =
    payload.call_room.media_type === "video" && payload.publish_mode === "video";
  const callStatus = formatCallStatus(payload.call_room);
  const mediaSummary = payload.publish_mode === "video" ? "Camera + mic" : "Mic only";

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#05070d] text-white">
      <div className="relative flex h-full flex-col px-4 pb-24 pt-4 md:px-6 md:pt-5">
        <header className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,27,50,0.94)_0%,rgba(14,20,38,0.9)_100%)] px-5 py-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                Live Session
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-white">
                  {getCallLabel(payload.call_room)}
                </h2>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/80">
                  <Video className="h-3.5 w-3.5" />
                  {callStatus}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-xs font-medium text-white/62">
                  <Lock className="h-3.5 w-3.5" />
                  End-to-end encrypted
                </span>

                {isRoomLocked ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/18 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-50">
                    <Lock className="h-3.5 w-3.5" />
                    Locked to new joins
                  </span>
                ) : null}
              </div>

              <p className="text-sm text-white/58">
                Room {payload.call_room.room_uuid.slice(0, 8)} / {mediaSummary}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {showLockControl ? (
                <button
                  type="button"
                  onClick={onMuteAll}
                  disabled={isMutingAll}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2.5 text-sm font-medium text-white/82 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2.5 text-sm font-medium text-white/82 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Lock className="h-4 w-4" />
                  {isTogglingLock ? "Updating..." : isRoomLocked ? "Unlock room" : "Lock room"}
                </button>
              ) : null}

              {showEndForAll ? (
                <button
                  type="button"
                  onClick={onEndForAll}
                  disabled={isEndingForAll}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-400/28 bg-amber-500/12 px-4 py-2.5 text-sm font-medium text-amber-50 transition hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  End for all
                </button>
              ) : null}

              <button
                type="button"
                onClick={onMinimize}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2.5 text-sm font-medium text-white/82 transition hover:bg-white/10"
              >
                <Minimize2 className="h-4 w-4" />
                Minimize
              </button>

              <button
                type="button"
                onClick={onLeave}
                disabled={isLeaving}
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#ff6683_0%,#ff4b6e_100%)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_18px_34px_rgba(255,75,110,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PhoneOff className="h-4 w-4" />
                Leave call
              </button>
            </div>
          </div>

          {showLockControl && payload.call_room.scope === "group" && payload.call_room.participants ? (
            <>
              <CallParticipantManager
                participants={payload.call_room.participants}
                authUserId={authUserId}
                createdBy={payload.call_room.created_by}
                removingUserId={removingUserId}
                onRemoveParticipant={onRemoveParticipant}
              />
              {conversationMembers ? (
                <CallInviteManager
                  members={conversationMembers}
                  callRoom={payload.call_room}
                  authUserId={authUserId}
                  invitingUserId={invitingUserId}
                  onInviteUser={onInviteParticipant}
                />
              ) : null}
            </>
          ) : null}
        </header>

        <LiveKitRoom
          token={payload.token.token}
          serverUrl={normalizeLiveKitServerUrl(payload.token.url)}
          connect
          audio
          video={showCameraControls}
          data-lk-theme="default"
          className="flex min-h-0 flex-1 flex-col"
          onDisconnected={() => {
            onMinimize();
          }}
        >
          <RoomAudioRenderer />
          <CallModeratorMuteListener roomUuid={payload.call_room.room_uuid} authUserId={authUserId} />

          <div className="flex min-h-0 flex-1 py-4">
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <CallLiveKitFeedback />
              <div className="flex min-h-0 flex-1 overflow-hidden rounded-[34px]">
                <CallParticipantGrid />
              </div>
            </div>
          </div>

          <OverlayCallControls
            showCameraControls={showCameraControls}
            onLeave={onLeave}
            onEndForAll={onEndForAll}
            isLeaving={isLeaving}
            isEndingForAll={isEndingForAll}
            showEndForAll={showEndForAll}
          />
        </LiveKitRoom>
      </div>
    </div>
  );
}

export function CallRoomOverlay() {
  const {
    activeCall,
    isRoomOpen,
    minimizeRoom,
  } = useCallStore(useShallow((state) => ({
    activeCall: state.activeCall,
    isRoomOpen: state.isRoomOpen,
    minimizeRoom: state.minimizeRoom,
  })));
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const { data: conversations = [] } = useConversationsQuery(Boolean(authUserId));
  const endCallMutation = useEndCallMutation();
  const endCallForAllMutation = useEndCallForAllMutation();
  const lockRoomMutation = useLockCallRoomMutation();
  const unlockRoomMutation = useUnlockCallRoomMutation();
  const muteAllMutation = useMuteAllCallParticipantsMutation();
  const inviteParticipantsMutation = useInviteCallParticipantsMutation();
  const removeParticipantMutation = useRemoveCallParticipantMutation();
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);

  if (!activeCall?.token || !isRoomOpen) {
    return null;
  }

  const thread = conversations
    .map((conversation) => toConversationThread(conversation))
    .find((item) => item.numericId === activeCall.callRoom.conversation_id);
  const isManager =
    authUserId !== null &&
    (activeCall.callRoom.created_by === authUserId ||
      ["owner", "admin"].includes(thread?.membership?.role ?? ""));

  const showEndForAll =
    isManager && activeCall.callRoom.scope === "group";
  const showLockControl = isManager && activeCall.callRoom.scope === "group";

  return (
    <LiveKitCallPanel
      payload={{
        call_room: activeCall.callRoom,
        publish_mode: activeCall.publishMode ?? "audio",
        token: activeCall.token,
      }}
      onMinimize={minimizeRoom}
      onLeave={() => {
        void endCallMutation.mutateAsync({
          roomUuid: activeCall.callRoom.room_uuid,
          reason: "left_from_web_room",
        });
      }}
      onEndForAll={
        showEndForAll
          ? () => {
              void endCallForAllMutation.mutateAsync({
                roomUuid: activeCall.callRoom.room_uuid,
                reason: "ended_from_web_room",
              });
            }
          : undefined
      }
      onToggleLock={
        showLockControl
          ? () => {
              const mutation = activeCall.callRoom.is_locked ? unlockRoomMutation : lockRoomMutation;
              void mutation.mutateAsync(activeCall.callRoom.room_uuid);
            }
          : undefined
      }
      onMuteAll={
        showLockControl
          ? () => {
              void muteAllMutation.mutateAsync(activeCall.callRoom.room_uuid);
            }
          : undefined
      }
      onRemoveParticipant={
        showLockControl
          ? (userId) => {
              setRemovingUserId(userId);
              void removeParticipantMutation
                .mutateAsync({
                  roomUuid: activeCall.callRoom.room_uuid,
                  userId,
                  reason: "removed_from_overlay",
                })
                .finally(() => {
                  setRemovingUserId((current) => (current === userId ? null : current));
                });
            }
          : undefined
      }
      onInviteParticipant={
        showLockControl
          ? (userId) => {
              setInvitingUserId(userId);
              void inviteParticipantsMutation
                .mutateAsync({
                  roomUuid: activeCall.callRoom.room_uuid,
                  userIds: [userId],
                })
                .finally(() => {
                  setInvitingUserId((current) => (current === userId ? null : current));
                });
            }
          : undefined
      }
      isLeaving={endCallMutation.isPending}
      isEndingForAll={endCallForAllMutation.isPending}
      isTogglingLock={lockRoomMutation.isPending || unlockRoomMutation.isPending}
      isMutingAll={muteAllMutation.isPending}
      showEndForAll={showEndForAll}
      showLockControl={showLockControl}
      isRoomLocked={activeCall.callRoom.is_locked}
      removingUserId={removingUserId}
      invitingUserId={invitingUserId}
      authUserId={authUserId}
      conversationMembers={thread?.members}
    />
  );
}
