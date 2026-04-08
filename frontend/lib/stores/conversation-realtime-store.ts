import { create } from "zustand";

type ConversationRealtimeState = {
  typingUsersByConversation: Record<string, { id: number; name: string }[]>;
  setTypingUsers: (conversationId: string, users: { id: number; name: string }[]) => void;
  addTypingUser: (conversationId: string, user: { id: number; name: string }) => void;
  removeTypingUser: (conversationId: string, userId: number) => void;
  clearConversation: (conversationId: string) => void;
};

export const useConversationRealtimeStore = create<ConversationRealtimeState>((set) => ({
  typingUsersByConversation: {},
  setTypingUsers: (conversationId, users) =>
    set((state) => ({
      typingUsersByConversation: {
        ...state.typingUsersByConversation,
        [conversationId]: users,
      },
    })),
  addTypingUser: (conversationId, user) =>
    set((state) => {
      const existing = state.typingUsersByConversation[conversationId] ?? [];

      if (existing.some((item) => item.id === user.id)) {
        return state;
      }

      return {
        typingUsersByConversation: {
          ...state.typingUsersByConversation,
          [conversationId]: [...existing, user],
        },
      };
    }),
  removeTypingUser: (conversationId, userId) =>
    set((state) => ({
      typingUsersByConversation: {
        ...state.typingUsersByConversation,
        [conversationId]: (state.typingUsersByConversation[conversationId] ?? []).filter((item) => item.id !== userId),
      },
    })),
  clearConversation: (conversationId) =>
    set((state) => {
      const next = { ...state.typingUsersByConversation };
      delete next[conversationId];
      return { typingUsersByConversation: next };
    }),
}));
