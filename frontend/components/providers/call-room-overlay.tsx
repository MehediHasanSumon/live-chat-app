"use client";

import {
  ControlBar,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { Minimize2, PhoneOff, Video } from "lucide-react";
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
    <div className="grid flex-1 auto-rows-[minmax(180px,1fr)] grid-cols-1 gap-3 overflow-auto p-4 md:grid-cols-2 xl:grid-cols-3">
      {tracks.map((trackRef) => {
        const key = `${trackRef.participant.identity}-${trackRef.source}`;

        return (
          <div
            key={key}
            className="overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(19,24,42,0.76)] shadow-[0_24px_60px_rgba(6,10,22,0.35)]"
          >
            <ParticipantTile trackRef={trackRef} />
          </div>
        );
      })}
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

  return (
    <div className="fixed inset-0 z-[60] bg-[radial-gradient(circle_at_top,rgba(61,76,132,0.34),transparent_28%),linear-gradient(180deg,#0b1020_0%,#10182f_100%)] text-white">
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
              Live Session
            </p>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{getCallLabel(payload.call_room)}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                <Video className="h-3.5 w-3.5" />
                {formatCallStatus(payload.call_room)}
              </span>
            </div>
            <p className="text-sm text-white/60">
              Room {payload.call_room.room_uuid.slice(0, 8)} · {payload.publish_mode === "video" ? "Camera + mic" : "Mic only"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMinimize}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              <Minimize2 className="h-4 w-4" />
              Minimize
            </button>
            <button
              type="button"
              onClick={onLeave}
              disabled={isLeaving}
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#ff6b83_0%,#ff4b6e_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_16px_30px_rgba(255,75,110,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PhoneOff className="h-4 w-4" />
              Leave call
            </button>
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
          <CallParticipantGrid />
          <div className="border-t border-white/10 bg-[rgba(7,10,20,0.82)] px-4 py-3">
            <ControlBar
              variation="minimal"
              controls={{
                microphone: true,
                camera: showCameraControls,
                screenShare: false,
                settings: true,
                chat: false,
                leave: false,
              }}
            />
          </div>
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
