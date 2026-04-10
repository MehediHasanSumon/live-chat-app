"use client";

import { X } from "lucide-react";

type MessagesConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function MessagesConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel,
  isPending = false,
  onClose,
  onConfirm,
}: MessagesConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(35,37,58,0.28)] px-4 backdrop-blur-sm">
      <div className="w-full max-w-[400px] overflow-hidden rounded-[1rem] border border-[var(--line)] bg-[rgba(255,255,255,0.96)] text-[var(--foreground)] shadow-[0_24px_60px_rgba(35,37,58,0.16)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close confirmation modal"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[rgba(96,91,255,0.16)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="text-[14px] leading-6 text-[var(--muted)]">{description}</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-10 rounded-xl border border-[var(--line)] bg-white text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              {isPending ? "Please wait..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
