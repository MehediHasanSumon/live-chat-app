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

export type ChatMessage = {
  id: string;
  sender: "me" | "other";
  body: string;
  time: string;
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
    name: conversation.type === "group" ? conversation.title ?? `Group #${conversation.id}` : buildDirectConversationName(conversation),
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

export function getPlaceholderMessages(thread: ConversationThread): ChatMessage[] {
  return [
    {
      id: `${thread.id}-m1`,
      sender: "other",
      body: thread.lastMessage || `Conversation #${thread.numericId} is ready. Real message history will plug in next.`,
      time: thread.time,
    },
    {
      id: `${thread.id}-m2`,
      sender: "me",
      body: thread.isGroup
        ? "Group shell is live. We can wire the real message timeline next."
        : "Direct conversation shell is live. Real messages come in the next backend phase.",
      time: "Now",
    },
  ];
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
