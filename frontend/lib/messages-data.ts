export type ConversationUser = {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: "active" | "suspended" | "deleted";
  last_seen_at: string | null;
  avatar_object_id: number | null;
};

export type ConversationMembership = {
  id: number;
  user_id: number;
  role: "owner" | "admin" | "member";
  membership_state: "active" | "request_pending" | "invited" | "left" | "removed";
  last_read_seq: number;
  last_delivered_seq: number;
  unread_count_cache: number;
  archived_at: string | null;
  pinned_at: string | null;
  muted_until: string | null;
  notifications_mode: "all" | "mentions" | "mute" | "scheduled";
  notification_schedule_json: Record<string, unknown> | null;
  joined_at: string | null;
  user?: ConversationUser;
};

export type ConversationApiItem = {
  id: number;
  type: "direct" | "group";
  direct_key: string | null;
  title: string | null;
  description: string | null;
  avatar_object_id: number | null;
  created_by: number;
  settings_json: Record<string, unknown> | null;
  last_message_seq: number;
  last_message_id: number | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  active_room_uuid: string | null;
  created_at: string;
  updated_at: string;
  creator?: ConversationUser;
  membership?: ConversationMembership | null;
  members?: ConversationMembership[];
};

export type ConversationThread = {
  id: string;
  numericId: number;
  name: string;
  handle: string;
  description?: string | null;
  lastMessage: string;
  time: string;
  unreadCount?: number;
  online?: boolean;
  isGroup?: boolean;
  membership?: ConversationMembership | null;
  members?: ConversationMembership[];
};

export type StorageObjectApiItem = {
  id: number;
  object_uuid: string;
  owner_user_id: number | null;
  purpose: "message_attachment" | "user_avatar" | "group_avatar";
  media_kind: "image" | "video" | "audio" | "voice" | "file" | "gif";
  storage_driver: "local";
  original_name: string;
  mime_type: string;
  file_ext: string | null;
  size_bytes: number;
  checksum_sha256: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  waveform_json: number[] | null;
  thumbnail_path: string | null;
  preview_blurhash: string | null;
  virus_scan_status: "pending" | "clean" | "infected" | "failed";
  transcode_status: "pending" | "processing" | "ready" | "failed";
  ref_count: number;
  first_attached_at: string | null;
  last_attached_at: string | null;
  retention_mode: "default" | "exempt";
  delete_eligible_at: string | null;
  deleted_at: string | null;
  deleted_reason: string | null;
  download_url: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageAttachmentApiItem = {
  id: number;
  message_id: number;
  conversation_id: number;
  storage_object_id: number;
  uploader_user_id: number;
  display_order: number;
  created_at: string | null;
  storage_object?: StorageObjectApiItem;
};

export type MessageApiItem = {
  id: number;
  conversation_id: number;
  seq: number;
  sender_id: number;
  client_uuid: string | null;
  type: string;
  sub_type: string | null;
  text_body: string | null;
  display_text: string | null;
  reply_to_message_id: number | null;
  quote_snapshot_json: Record<string, unknown> | null;
  forwarded_from_message_id: number | null;
  forwarded_from_conversation_id: number | null;
  forwarded_from_user_id: number | null;
  metadata_json: Record<string, unknown> | null;
  is_edited: boolean;
  edited_at: string | null;
  editable_until_at: string | null;
  deleted_for_everyone_at: string | null;
  deleted_for_everyone_by: number | null;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
  can_unsend: boolean;
  sender?: ConversationUser | null;
  attachments?: MessageAttachmentApiItem[];
};

export type ComposerAttachmentInput = {
  id: string;
  file: File;
  kind: "image" | "file";
  previewUrl?: string;
};

export type ChatMessage = {
  id: string;
  sender: "me" | "other";
  body: string;
  time: string;
  senderName?: string;
  isEdited?: boolean;
  isDeletedForEveryone?: boolean;
  attachments?: {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    downloadUrl: string | null;
  }[];
};

export type ThreadMediaItem = {
  id: string;
  type: "media" | "file";
  title: string;
  preview?: string;
  meta?: string;
};

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildDirectConversationName(conversation: ConversationApiItem): string {
  const otherMember = conversation.members?.find(
    (member) => member.user && member.user_id !== conversation.membership?.user_id,
  )?.user;

  return otherMember?.name ?? conversation.title ?? `Conversation #${conversation.id}`;
}

function buildConversationHandle(conversation: ConversationApiItem): string {
  if (conversation.type === "group") {
    return `#group-${conversation.id}`;
  }

  const otherMember = conversation.members?.find(
    (member) => member.user && member.user_id !== conversation.membership?.user_id,
  )?.user;

  return otherMember?.username ? `@${otherMember.username}` : `@conversation-${conversation.id}`;
}

export function toConversationThread(conversation: ConversationApiItem): ConversationThread {
  return {
    id: String(conversation.id),
    numericId: conversation.id,
    name:
      conversation.type === "group"
        ? conversation.title ?? `Group #${conversation.id}`
        : buildDirectConversationName(conversation),
    handle: buildConversationHandle(conversation),
    description: conversation.description,
    lastMessage: conversation.last_message_preview ?? "No messages yet",
    time: formatRelativeTime(conversation.last_message_at ?? conversation.updated_at),
    unreadCount: conversation.membership?.unread_count_cache || undefined,
    online: false,
    isGroup: conversation.type === "group",
    membership: conversation.membership,
    members: conversation.members,
  };
}

export function getPlaceholderMedia(thread: ConversationThread): ThreadMediaItem[] {
  return [
    {
      id: `${thread.id}-media-1`,
      type: "media",
      title: `${thread.name} preview`,
      preview: thread.name.slice(0, 2).toUpperCase(),
      meta: "Image",
    },
    {
      id: `${thread.id}-file-1`,
      type: "file",
      title: `${thread.handle.replace(/[^a-z0-9#@-]/gi, "")}-notes.txt`,
      meta: "14 KB",
    },
  ];
}

export function toChatMessage(message: MessageApiItem, authUserId?: number | null): ChatMessage {
  return {
    id: String(message.id),
    sender: authUserId !== undefined && authUserId !== null && message.sender_id === authUserId ? "me" : "other",
    body: message.display_text ?? message.text_body ?? "Unsupported message",
    time: formatRelativeTime(message.created_at),
    senderName: message.sender?.name ?? undefined,
    isEdited: message.is_edited,
    isDeletedForEveryone: Boolean(message.deleted_for_everyone_at),
    attachments:
      message.attachments?.map((attachment) => ({
        id: String(attachment.id),
        name: attachment.storage_object?.original_name ?? `Attachment #${attachment.storage_object_id}`,
        mimeType: attachment.storage_object?.mime_type ?? "application/octet-stream",
        sizeBytes: attachment.storage_object?.size_bytes ?? 0,
        downloadUrl: attachment.storage_object?.download_url ?? null,
      })) ?? [],
  };
}
