import { create } from "zustand";

export type AsideView = "info" | "media" | "file";
export type ConfirmationAction = "block" | "delete" | null;

type ChatUiState = {
  activeThreadId: string | null;
  asideView: AsideView;
  confirmationAction: ConfirmationAction;
  confirmationThreadId: string | null;
  isInfoSidebarOpen: boolean;
  isMuteModalOpen: boolean;
  muteThreadId: string | null;
  isNewMessageModalOpen: boolean;
  setActiveThreadId: (threadId: string | null) => void;
  openNewMessageModal: () => void;
  closeNewMessageModal: () => void;
  openMuteModal: (threadId?: string | null) => void;
  closeMuteModal: () => void;
  openConfirmation: (action: Exclude<ConfirmationAction, null>, threadId?: string | null) => void;
  closeConfirmation: () => void;
  openAsideView: (view: AsideView) => void;
  toggleInfoSidebar: () => void;
  resetThreadPanels: () => void;
};

export const useChatUiStore = create<ChatUiState>((set) => ({
  activeThreadId: null,
  asideView: "info",
  confirmationAction: null,
  confirmationThreadId: null,
  isInfoSidebarOpen: true,
  isMuteModalOpen: false,
  muteThreadId: null,
  isNewMessageModalOpen: false,
  setActiveThreadId: (threadId) => set({ activeThreadId: threadId }),
  openNewMessageModal: () => set({ isNewMessageModalOpen: true }),
  closeNewMessageModal: () => set({ isNewMessageModalOpen: false }),
  openMuteModal: (threadId) =>
    set((state) => ({
      isMuteModalOpen: true,
      muteThreadId: threadId ?? state.activeThreadId,
    })),
  closeMuteModal: () => set({ isMuteModalOpen: false, muteThreadId: null }),
  openConfirmation: (action, threadId) =>
    set((state) => ({
      confirmationAction: action,
      confirmationThreadId: threadId ?? state.activeThreadId,
    })),
  closeConfirmation: () => set({ confirmationAction: null, confirmationThreadId: null }),
  openAsideView: (view) => set({ asideView: view, isInfoSidebarOpen: true }),
  toggleInfoSidebar: () =>
    set((state) => {
      const nextIsOpen = !state.isInfoSidebarOpen;

      return {
        isInfoSidebarOpen: nextIsOpen,
        asideView: nextIsOpen ? "info" : state.asideView,
      };
    }),
  resetThreadPanels: () =>
    set({
      asideView: "info",
      confirmationAction: null,
      confirmationThreadId: null,
      isInfoSidebarOpen: true,
      isMuteModalOpen: false,
      muteThreadId: null,
    }),
}));
