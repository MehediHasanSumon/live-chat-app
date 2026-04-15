import { create } from "zustand";

export type ToastTone = "success" | "error" | "message";

export type AppToast = {
  id: string;
  kind: "crud" | "message";
  tone: ToastTone;
  title: string;
  message: string;
  conversationId?: string;
  senderName?: string;
  createdAt: number;
  durationMs: number;
};

type ToastState = {
  toasts: AppToast[];
  addToast: (toast: Omit<AppToast, "id" | "createdAt" | "durationMs"> & { id?: string; durationMs?: number }) => string;
  dismissToast: (toastId: string) => void;
  clearToasts: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = toast.id ?? crypto.randomUUID();

    set((state) => ({
      toasts: [
        {
          ...toast,
          id,
          createdAt: Date.now(),
          durationMs: toast.durationMs ?? (toast.kind === "message" ? 8000 : 4500),
        },
        ...state.toasts.filter((item) => item.id !== id),
      ].slice(0, 5),
    }));

    return id;
  },
  dismissToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== toastId),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

export function pushToast(toast: Parameters<ToastState["addToast"]>[0]) {
  if (typeof window === "undefined") {
    return null;
  }

  return useToastStore.getState().addToast(toast);
}
