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
  avatar_object?: StorageObjectApiItem | null;
  created_by: number;
  settings_json: Record<string, unknown> | null;
  last_message_seq: number;
  last_message_id: number | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  active_room_uuid: string | null;
  is_chat_blocked?: boolean;
  created_at: string;
  updated_at: string;
  creator?: ConversationUser;
  membership?: ConversationMembership | null;
  members?: ConversationMembership[];
};

export type MessageThread = {
  id: string;
  numericId: number;
  lastMessageSeq: number;
  name: string;
  avatarUrl?: string | null;
  avatarObjectId?: number | null;
  handle: string;
  description?: string | null;
  lastMessage: string;
  time: string;
  unreadCount?: number;
  online?: boolean;
  isChatBlocked?: boolean;
  presence?: {
    visible: boolean;
    isOnline: boolean;
    lastSeenAt: string | null;
  } | null;
  isGroup?: boolean;
  membership?: ConversationMembership | null;
  members?: ConversationMembership[];
};

export type UserPresenceApiItem = {
  user_id: number;
  visible: boolean;
  is_online: boolean;
  last_seen_at: string | null;
  presence_key: string | null;
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
  is_expired?: boolean;
  placeholder_text?: string | null;
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
  message?: {
    id: number;
    sender_id: number;
    created_at: string;
    sender?: ConversationUser | null;
  };
};

export type MessageReactionApiItem = {
  id: number;
  message_id: number;
  user_id: number;
  emoji: string;
  created_at: string | null;
  user?: ConversationUser | null;
};

export type MessageApiItem = {
  id: number;
  conversation_id: number;
  seq: number;
  sender_id: number;
  client_uuid: string | null;
  call_room_uuid: string | null;
  type: string;
  sub_type: string | null;
  text_body: string | null;
  display_text: string | null;
  reply_to_message_id: number | null;
  reply_to?: {
    id: number;
    sender_id: number;
    type: string;
    text_body: string | null;
    created_at: string;
    sender?: ConversationUser | null;
  } | null;
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
  reactions?: MessageReactionApiItem[];
  attachments?: MessageAttachmentApiItem[];
};

export type ComposerAttachmentInput = {
  id: string;
  file: File;
  kind: "image" | "file";
  previewUrl?: string;
};

export type ComposerVoiceInput = {
  id: string;
  file: File;
  durationMs: number;
};

export type ComposerGifInput = {
  url: string;
  title?: string;
  previewUrl?: string;
  provider?: string;
};

export type ChatReaction = {
  emoji: string;
  count: number;
  userIds: number[];
};

export type ChatMessage = {
  id: string;
  numericId: number;
  seq: number;
  type: string;
  subType?: string | null;
  sender: "me" | "other";
  senderId: number;
  body: string;
  time: string;
  senderName?: string;
  senderUsername?: string;
  isEdited?: boolean;
  isDeletedForEveryone?: boolean;
  isForwarded?: boolean;
  canEdit?: boolean;
  canUnsend?: boolean;
  quote?: {
    senderName?: string;
    text: string;
  } | null;
  gifUrl?: string | null;
  reactions?: ChatReaction[];
  isPending?: boolean;
  attachments?: {
    id: string;
    name: string;
    mimeType: string;
    mediaKind: "image" | "video" | "audio" | "voice" | "file" | "gif";
    sizeBytes: number;
    width: number | null;
    height: number | null;
    downloadUrl: string | null;
    isExpired: boolean;
    placeholderText: string | null;
  }[];
  call?: {
    roomUuid: string | null;
    action: string | null;
    status: string | null;
    mediaType: "voice" | "video" | null;
    durationSeconds: number;
  } | null;
};

const attachmentPlaceholderBodies = new Set([
  "Shared photo",
  "Shared video",
  "Shared attachment",
  "Photo",
  "File",
]);

export type ThreadMediaItem = {
  id: string;
  type: "media" | "file";
  title: string;
  preview?: string;
  previewUrl?: string | null;
  meta?: string;
  downloadUrl?: string | null;
  isExpired?: boolean;
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

export function toConversationThread(conversation: ConversationApiItem): MessageThread {
  return {
    id: String(conversation.id),
    numericId: conversation.id,
    lastMessageSeq: conversation.last_message_seq,
    name:
      conversation.type === "group"
        ? conversation.title ?? `Group #${conversation.id}`
        : buildDirectConversationName(conversation),
    avatarUrl: conversation.avatar_object?.download_url ?? null,
    avatarObjectId: conversation.avatar_object_id,
    handle: buildConversationHandle(conversation),
    description: conversation.description,
    lastMessage: conversation.last_message_preview ?? "No messages yet",
    time: formatRelativeTime(conversation.last_message_at ?? conversation.updated_at),
    unreadCount: conversation.membership?.unread_count_cache || undefined,
    online: false,
    isChatBlocked: conversation.is_chat_blocked ?? false,
    presence: null,
    isGroup: conversation.type === "group",
    membership: conversation.membership,
    members: conversation.members,
  };
}

export function getDirectThreadPeer(thread: MessageThread) {
  if (thread.isGroup) {
    return null;
  }

  return (thread.members ?? []).find((member) => member.user && member.user_id !== thread.membership?.user_id) ?? null;
}

export function applyPresenceToThread(
  thread: MessageThread,
  presence: UserPresenceApiItem | null | undefined,
): MessageThread {
  if (!presence || thread.isGroup) {
    return {
      ...thread,
      online: false,
      presence: null,
    };
  }

  return {
    ...thread,
    online: presence.visible && presence.is_online,
    presence: {
      visible: presence.visible,
      isOnline: presence.is_online,
      lastSeenAt: presence.last_seen_at,
    },
  };
}

export function formatPresenceLabel(presence: MessageThread["presence"]): string | null {
  if (!presence?.visible) {
    return null;
  }

  if (presence.isOnline) {
    return "Online";
  }

  if (!presence.lastSeenAt) {
    return "Offline";
  }

  const date = new Date(presence.lastSeenAt);

  if (Number.isNaN(date.getTime())) {
    return "Offline";
  }

  return `Last seen ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}

export function toThreadMediaItems(items: MessageAttachmentApiItem[]): ThreadMediaItem[] {
  return items.map((item) => ({
    id: String(item.id),
    type: item.storage_object?.media_kind === "file" ? "file" : "media",
    title: item.storage_object?.original_name ?? `Attachment #${item.storage_object_id}`,
    preview: item.storage_object?.media_kind === "image" || item.storage_object?.media_kind === "gif"
      ? item.storage_object.original_name.slice(0, 2).toUpperCase()
      : undefined,
    previewUrl:
      item.storage_object?.media_kind === "image" || item.storage_object?.media_kind === "gif"
        ? item.storage_object.download_url
        : null,
    meta: item.storage_object
      ? `${Math.max(1, Math.round(item.storage_object.size_bytes / 1024))} KB`
      : undefined,
    downloadUrl: item.storage_object?.download_url ?? null,
    isExpired: Boolean(item.storage_object?.deleted_at),
  }));
}

export function toChatMessage(message: MessageApiItem, authUserId?: number | null): ChatMessage {
  const reactionsMap = new Map<string, ChatReaction>();

  message.reactions?.forEach((reaction) => {
    const current = reactionsMap.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      userIds: [],
    };

    current.count += 1;
    current.userIds.push(reaction.user_id);
    reactionsMap.set(reaction.emoji, current);
  });

  const normalizedBody =
    message.display_text ?? message.text_body ?? "";
  const hasAttachments = (message.attachments?.length ?? 0) > 0;
  const body =
    hasAttachments && attachmentPlaceholderBodies.has(normalizedBody.trim())
      ? ""
      : normalizedBody || "Unsupported message";

  return {
    id: String(message.id),
    numericId: message.id,
    seq: message.seq,
    type: message.type,
    subType: message.sub_type,
    sender: authUserId !== undefined && authUserId !== null && message.sender_id === authUserId ? "me" : "other",
    senderId: message.sender_id,
    body,
    time: formatRelativeTime(message.created_at),
    senderName: message.sender?.name ?? undefined,
    senderUsername: message.sender?.username ?? undefined,
    isEdited: message.is_edited,
    isDeletedForEveryone: Boolean(message.deleted_for_everyone_at),
    isForwarded: Boolean(message.forwarded_from_message_id),
    canEdit: message.can_edit,
    canUnsend: message.can_unsend,
    quote: message.quote_snapshot_json
      ? {
          senderName:
            typeof message.quote_snapshot_json.sender_name === "string"
              ? message.quote_snapshot_json.sender_name
              : undefined,
          text:
            typeof message.quote_snapshot_json.text_body === "string"
              ? message.quote_snapshot_json.text_body
              : "Quoted message",
        }
      : null,
    gifUrl:
      message.type === "gif" && typeof message.metadata_json?.url === "string"
        ? message.metadata_json.url
        : null,
    reactions: Array.from(reactionsMap.values()),
    attachments:
      message.attachments?.map((attachment) => ({
        id: String(attachment.id),
        name: attachment.storage_object?.original_name ?? `Attachment #${attachment.storage_object_id}`,
        mimeType: attachment.storage_object?.mime_type ?? "application/octet-stream",
        mediaKind: attachment.storage_object?.media_kind ?? "file",
        sizeBytes: attachment.storage_object?.size_bytes ?? 0,
        width: attachment.storage_object?.width ?? null,
        height: attachment.storage_object?.height ?? null,
        downloadUrl: attachment.storage_object?.download_url ?? null,
        isExpired: Boolean(attachment.storage_object?.deleted_at),
        placeholderText: attachment.storage_object?.placeholder_text ?? null,
      })) ?? [],
    call:
      message.type === "call"
        ? {
            roomUuid: message.call_room_uuid,
            action: typeof message.metadata_json?.action === "string" ? message.metadata_json.action : null,
            status: typeof message.metadata_json?.status === "string" ? message.metadata_json.status : null,
            mediaType:
              message.metadata_json?.media_type === "voice" || message.metadata_json?.media_type === "video"
                ? message.metadata_json.media_type
                : null,
            durationSeconds:
              typeof message.metadata_json?.duration_seconds === "number"
                ? message.metadata_json.duration_seconds
                : 0,
          }
        : null,
  };
}
