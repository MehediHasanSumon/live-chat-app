import { type ConversationUser, type MessageThread } from "@/lib/messages-data";

export type CallRoomParticipantApiItem = {
  id: number;
  call_room_id: number;
  user_id: number;
  invite_status: "invited" | "ringing" | "accepted" | "declined" | "missed" | "left" | "kicked";
  joined_at: string | null;
  left_at: string | null;
  left_reason: string | null;
  is_video_publisher: boolean;
  created_at: string;
  updated_at: string;
  user?: ConversationUser;
};

export type CallRoomApiItem = {
  id: number;
  room_uuid: string;
  conversation_id: number;
  scope: "direct" | "group";
  media_type: "voice" | "video";
  created_by: number;
  status: "calling" | "ringing" | "connecting" | "active" | "ended" | "missed" | "declined" | "cancelled" | "failed";
  is_locked: boolean;
  max_participants: number;
  max_video_publishers: number;
  started_at: string | null;
  ended_at: string | null;
  ended_reason: string | null;
  duration_seconds: number | null;
  last_webhook_at: string | null;
  created_at: string;
  updated_at: string;
  participants?: CallRoomParticipantApiItem[];
};

export type JoinTokenApiItem = {
  token: string;
  url: string;
  room: string;
  identity: string;
  ttl: number;
};

export type JoinCallApiPayload = {
  call_room: CallRoomApiItem;
  publish_mode: "audio" | "video";
  token: JoinTokenApiItem;
};

export type CallSignalPayload = {
  action: string;
  call_room: CallRoomApiItem;
};

export type CallMuteRequestPayload = {
  room_uuid: string;
  actor_user_id: number;
};

export function getDirectCallTargetUserId(
  thread: MessageThread,
  authUserId: number,
): number | null {
  const otherMember = thread.members?.find((member) => member.user_id !== authUserId);

  return otherMember?.user_id ?? null;
}

export function getCallParticipant(
  callRoom: CallRoomApiItem | null | undefined,
  userId: number | null | undefined,
): CallRoomParticipantApiItem | null {
  if (!callRoom || userId == null) {
    return null;
  }

  return callRoom.participants?.find((participant) => participant.user_id === userId) ?? null;
}

export function isCallParticipantInactive(
  participant: CallRoomParticipantApiItem | null | undefined,
): boolean {
  if (!participant) {
    return true;
  }

  return ["declined", "missed", "left", "kicked"].includes(participant.invite_status);
}

export function isCallTerminal(callRoom: CallRoomApiItem | null | undefined): boolean {
  if (!callRoom) {
    return true;
  }

  return ["ended", "missed", "declined", "cancelled", "failed"].includes(callRoom.status);
}

export function formatCallStatus(callRoom: CallRoomApiItem): string {
  switch (callRoom.status) {
    case "calling":
      return "Calling";
    case "ringing":
      return "Ringing";
    case "connecting":
      return "Connecting";
    case "active":
      return "Active";
    case "declined":
      return "Declined";
    case "missed":
      return "Missed";
    case "ended":
      return "Ended";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Starting";
  }
}

export function getCallLabel(callRoom: CallRoomApiItem): string {
  return callRoom.media_type === "video" ? "Video call" : "Voice call";
}
