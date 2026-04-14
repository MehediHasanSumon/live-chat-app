"use client";

import {
  ParticipantTile,
  useConnectionQualityIndicator,
  useConnectionState,
  useIsSpeaking,
  useLocalParticipant,
  useRemoteParticipants,
  useSpeakingParticipants,
  type TrackRefContextIfNeeded,
} from "@livekit/components-react";
import { AlertTriangle, Radio, Wifi } from "lucide-react";
import { ConnectionQuality, ConnectionState } from "livekit-client";

function getConnectionLabel(connectionState: ConnectionState): string {
  switch (connectionState) {
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      return "Reconnecting";
    case ConnectionState.Connecting:
      return "Connecting";
    case ConnectionState.Connected:
      return "Stable";
    default:
      return "Waiting";
  }
}

function getConnectionTone(connectionState: ConnectionState): string {
  switch (connectionState) {
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      return "border-amber-300/25 bg-amber-400/12 text-amber-50";
    case ConnectionState.Connecting:
      return "border-sky-300/25 bg-sky-400/12 text-sky-50";
    case ConnectionState.Connected:
      return "border-emerald-300/18 bg-emerald-400/10 text-emerald-50";
    default:
      return "border-white/10 bg-white/8 text-white/72";
  }
}

function getQualityLabel(quality: ConnectionQuality): string {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return "Excellent";
    case ConnectionQuality.Good:
      return "Good";
    case ConnectionQuality.Poor:
      return "Weak";
    default:
      return "Checking";
  }
}

function getQualityTone(quality: ConnectionQuality): string {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return "border-emerald-300/18 bg-emerald-400/10 text-emerald-50";
    case ConnectionQuality.Good:
      return "border-sky-300/20 bg-sky-400/10 text-sky-50";
    case ConnectionQuality.Poor:
      return "border-rose-300/22 bg-rose-400/10 text-rose-50";
    default:
      return "border-white/10 bg-white/8 text-white/72";
  }
}

export function SpeakingParticipantTile({ trackRef }: { trackRef: TrackRefContextIfNeeded }) {
  const isSpeaking = useIsSpeaking(trackRef.participant);

  return (
    <div
      className={`relative h-full overflow-hidden rounded-[inherit] border transition ${
        isSpeaking
          ? "border-emerald-300/45 shadow-[0_0_0_1px_rgba(110,231,183,0.22),0_28px_70px_rgba(16,185,129,0.16)]"
          : "border-transparent"
      }`}
    >
      <ParticipantTile trackRef={trackRef} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-[rgba(9,13,26,0.6)] px-2.5 py-1 text-[11px] font-medium text-white/82 backdrop-blur">
          <Wifi className="h-3 w-3" />
          {trackRef.participant.name || trackRef.participant.identity}
        </span>

        {isSpeaking ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/14 px-2.5 py-1 text-[11px] font-semibold text-emerald-50 backdrop-blur">
            <Radio className="h-3 w-3" />
            Speaking
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CallLiveKitFeedback({ compact = false }: { compact?: boolean }) {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const speakingParticipants = useSpeakingParticipants();
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });
  const topSpeaker = speakingParticipants[0];
  const isRecovering =
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting ||
    connectionState === ConnectionState.Connecting;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {isRecovering ? (
        <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/24 bg-amber-400/12 px-4 py-2 text-sm font-medium text-amber-50 shadow-[0_18px_38px_rgba(245,158,11,0.12)] backdrop-blur">
          <AlertTriangle className="h-4 w-4" />
          {connectionState === ConnectionState.Connecting
            ? "Joining call and checking media routes..."
            : "Network changed. Reconnecting to the call..."}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur ${getConnectionTone(connectionState)}`}>
          <Radio className="h-3.5 w-3.5" />
          {getConnectionLabel(connectionState)}
        </span>

        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur ${getQualityTone(quality)}`}>
          <Wifi className="h-3.5 w-3.5" />
          Network {getQualityLabel(quality)}
        </span>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/76 backdrop-blur">
          <Radio className="h-3.5 w-3.5" />
          {remoteParticipants.length + 1} live
        </span>

        {topSpeaker ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-50 backdrop-blur">
            <Radio className="h-3.5 w-3.5" />
            Speaking: {topSpeaker.name || topSpeaker.identity}
          </span>
        ) : null}
      </div>
    </div>
  );
}
