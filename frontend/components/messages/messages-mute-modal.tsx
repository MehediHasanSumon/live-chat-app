"use client";

import { useState } from "react";

import { X } from "lucide-react";

const muteOptions = [
  "For 15 minutes",
  "For 1 Hour",
  "For 8 Hours",
  "For 24 Hours",
  "Until I turn it back on",
] as const;

type MessagesMuteModalProps = {
  isOpen: boolean;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: (option: (typeof muteOptions)[number]) => void;
};

export function MessagesMuteModal({ isOpen, isPending = false, onClose, onConfirm }: MessagesMuteModalProps) {
  const [selectedOption, setSelectedOption] =
    useState<(typeof muteOptions)[number]>("For 15 minutes");

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(35,37,58,0.28)] px-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] overflow-hidden rounded-[1rem] border border-[var(--line)] bg-[rgba(255,255,255,0.96)] text-[var(--foreground)] shadow-[0_24px_60px_rgba(35,37,58,0.16)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-[16px] font-semibold">Mute conversation</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mute modal"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[rgba(96,91,255,0.16)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="space-y-4">
            {muteOptions.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="mute-duration"
                  checked={selectedOption === option}
                  onChange={() => setSelectedOption(option)}
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                <span className="text-[14px] font-medium text-[var(--foreground)]">{option}</span>
              </label>
            ))}
          </div>

          <p className="mt-5 text-[13px] leading-6 text-[var(--muted)]">
            Chat windows will stay closed, and you won&apos;t get push notifications on your
            devices.
          </p>

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
              onClick={() => onConfirm(selectedOption)}
              disabled={isPending}
              className="h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              {isPending ? "Please wait..." : "Mute"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
