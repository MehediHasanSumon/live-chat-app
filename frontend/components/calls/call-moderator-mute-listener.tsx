"use client";

import { useLocalParticipant } from "@livekit/components-react";
import { useEffect } from "react";

import { type CallMuteRequestPayload } from "@/lib/calls-data";
import { getEchoInstance } from "@/lib/reverb";

export function CallModeratorMuteListener({
  roomUuid,
  authUserId,
}: {
  roomUuid: string;
  authUserId: number | null;
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  useEffect(() => {
    if (!authUserId || !roomUuid) {
      return;
    }

    const echo = getEchoInstance();

    if (!echo) {
      return;
    }

    const userChannel = echo.private(`user.${authUserId}`);

    const handleMuteRequested = (payload: CallMuteRequestPayload) => {
      if (payload.room_uuid !== roomUuid || payload.actor_user_id === authUserId || !isMicrophoneEnabled) {
        return;
      }

      void localParticipant.setMicrophoneEnabled(false);
    };

    userChannel.listen(".call.mute.requested", handleMuteRequested);

    return () => {
      userChannel.stopListening(".call.mute.requested", handleMuteRequested);
    };
  }, [authUserId, isMicrophoneEnabled, localParticipant, roomUuid]);

  return null;
}
