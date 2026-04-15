"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { type AppToast, useToastStore } from "@/lib/stores/toast-store";

function ToastIcon({ tone }: { tone: AppToast["tone"] }) {
  if (tone === "success") {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  if (tone === "error") {
    return <AlertCircle className="h-4 w-4" />;
  }

  return <MessageCircle className="h-4 w-4" />;
}

function ToastItem({ toast }: { toast: AppToast }) {
  const router = useRouter();
  const dismissToast = useToastStore((state) => state.dismissToast);
  const isMessageToast = toast.kind === "message" && toast.conversationId;

  useEffect(() => {
    const timeout = window.setTimeout(() => dismissToast(toast.id), toast.durationMs);

    return () => window.clearTimeout(timeout);
  }, [dismissToast, toast.durationMs, toast.id]);

  const openMessage = () => {
    if (!isMessageToast) {
      return;
    }

    dismissToast(toast.id);
    router.push(`/messages/t/${toast.conversationId}`);
  };

  return (
    <div
      className={cn(
        "w-[min(360px,calc(100vw-2rem))] rounded-[18px] border bg-white/96 p-3 text-[#27304d] shadow-[0_22px_60px_rgba(64,74,122,0.18)] backdrop-blur transition",
        toast.tone === "success" && "border-emerald-100",
        toast.tone === "error" && "border-rose-100",
        toast.tone === "message" && "border-[rgba(96,91,255,0.18)]",
      )}
      role="status"
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
    >
      <div className="flex gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            toast.tone === "success" && "bg-emerald-50 text-emerald-600",
            toast.tone === "error" && "bg-rose-50 text-rose-600",
            toast.tone === "message" && "bg-[var(--accent-soft)] text-[var(--accent)]",
          )}
        >
          <ToastIcon tone={toast.tone} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{toast.title}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#9aa3c4] transition hover:bg-slate-100 hover:text-[#4f587d]"
              aria-label="Close toast"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#667099]">{toast.message}</p>

          {isMessageToast ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={openMessage}
                className="rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(96,91,255,0.22)] transition hover:brightness-105"
              >
                Open
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[120] flex flex-col items-end gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
