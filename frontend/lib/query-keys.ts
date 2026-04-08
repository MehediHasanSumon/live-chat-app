export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  users: {
    search: (query: string) => ["users", "search", query] as const,
    presence: (userId: number) => ["users", "presence", userId] as const,
  },
  conversations: {
    all: ["conversations"] as const,
    detail: (conversationId: string | number) => ["conversations", String(conversationId)] as const,
    requests: ["conversations", "requests"] as const,
    sharedMedia: (conversationId: string | number) => ["conversations", String(conversationId), "shared-media"] as const,
    sharedFiles: (conversationId: string | number) => ["conversations", String(conversationId), "shared-files"] as const,
  },
  messages: {
    list: (conversationId: string | number) => ["messages", String(conversationId)] as const,
  },
  admin: {
    opsHealth: ["admin", "ops", "health"] as const,
    opsStatus: ["admin", "ops", "status"] as const,
  },
};
