import { create } from "zustand";

export type AsideView = "info" | "media" | "file";
export type ConfirmationAction = "block" | "delete" | null;

type ChatUiState = {
  activeThreadId: string | null;
  asideView: AsideView;
  confirmationAction: ConfirmationAction;
  isInfoSidebarOpen: boolean;
  isMuteModalOpen: boolean;
  isNewMessageModalOpen: boolean;
  setActiveThreadId: (threadId: string | null) => void;
  openNewMessageModal: () => void;
  closeNewMessageModal: () => void;
  openMuteModal: () => void;
  closeMuteModal: () => void;
  openConfirmation: (action: Exclude<ConfirmationAction, null>) => void;
  closeConfirmation: () => void;
  openAsideView: (view: AsideView) => void;
  toggleInfoSidebar: () => void;
  resetThreadPanels: () => void;
};

export const useChatUiStore = create<ChatUiState>((set) => ({
  activeThreadId: null,
  asideView: "info",
  confirmationAction: null,
  isInfoSidebarOpen: true,
  isMuteModalOpen: false,
  isNewMessageModalOpen: false,
  setActiveThreadId: (threadId) => set({ activeThreadId: threadId }),
  openNewMessageModal: () => set({ isNewMessageModalOpen: true }),
  closeNewMessageModal: () => set({ isNewMessageModalOpen: false }),
  openMuteModal: () => set({ isMuteModalOpen: true }),
  closeMuteModal: () => set({ isMuteModalOpen: false }),
  openConfirmation: (action) => set({ confirmationAction: action }),
  closeConfirmation: () => set({ confirmationAction: null }),
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
      isInfoSidebarOpen: true,
      isMuteModalOpen: false,
    }),
}));
