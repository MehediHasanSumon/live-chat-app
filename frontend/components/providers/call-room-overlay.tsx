"use client";

import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react";
import { Camera, CameraOff, Lock, Mic, MicOff, Minimize2, PhoneOff, Video } from "lucide-react";
import { Track } from "livekit-client";
import { useShallow } from "zustand/react/shallow";

import {
  formatCallStatus,
  getCallLabel,
  type JoinCallApiPayload,
} from "@/lib/calls-data";
import { useEndCallMutation } from "@/lib/hooks/use-call-mutations";
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
    <div className="grid flex-1 auto-rows-[minmax(220px,1fr)] grid-cols-1 gap-4 overflow-auto p-5 md:grid-cols-2 xl:grid-cols-3">
      {tracks.map((trackRef) => {
        const key = `${trackRef.participant.identity}-${trackRef.source}`;

        return (
          <div
            key={key}
            className="overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,24,44,0.96)_0%,rgba(14,18,34,0.94)_100%)] shadow-[0_28px_70px_rgba(4,8,20,0.42)]"
          >
            <ParticipantTile trackRef={trackRef} />
          </div>
        );
      })}
    </div>
  );
}

function OverlayCallControls({
  showCameraControls,
  onLeave,
  isLeaving,
}: {
  showCameraControls: boolean;
  onLeave: () => void;
  isLeaving: boolean;
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
  isLeaving: boolean;
};

function LiveKitCallPanel({
  payload,
  onMinimize,
  onLeave,
  isLeaving,
}: LiveKitCallPanelProps) {
  const showCameraControls =
    payload.call_room.media_type === "video" && payload.publish_mode === "video";
  const callStatus = formatCallStatus(payload.call_room);
  const mediaSummary = payload.publish_mode === "video" ? "Camera + mic" : "Mic only";

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(90,107,255,0.18),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(84,166,255,0.12),transparent_24%),linear-gradient(180deg,#0a1020_0%,#0b1224_38%,#09111d_100%)] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_18%)]" />

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
              </div>

              <p className="text-sm text-white/58">
                Room {payload.call_room.room_uuid.slice(0, 8)} / {mediaSummary}
              </p>
            </div>

            <div className="flex items-center gap-2">
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

          <div className="flex min-h-0 flex-1 py-4">
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-[34px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,29,0.92)_0%,rgba(8,12,22,0.94)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_32px_90px_rgba(0,0,0,0.34)]">
              <CallParticipantGrid />
            </div>
          </div>

          <OverlayCallControls
            showCameraControls={showCameraControls}
            onLeave={onLeave}
            isLeaving={isLeaving}
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
  const endCallMutation = useEndCallMutation();

  if (!activeCall?.token || !isRoomOpen) {
    return null;
  }

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
      isLeaving={endCallMutation.isPending}
    />
  );
}
