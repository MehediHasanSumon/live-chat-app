export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  conversations: {
    all: ["conversations"] as const,
    detail: (conversationId: string | number) => ["conversations", String(conversationId)] as const,
  },
};
