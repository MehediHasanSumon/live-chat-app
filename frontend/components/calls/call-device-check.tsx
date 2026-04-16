"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Headphones, Mic, RefreshCw, X } from "lucide-react";

import { SelectInput, SelectInputOption } from "@/components/ui/select-input";

function getDeviceLabel(device: MediaDeviceInfo, index: number): string {
  if (device.label.trim().length > 0) {
    return device.label;
  }

  switch (device.kind) {
    case "audioinput":
      return `Microphone ${index + 1}`;
    case "audiooutput":
      return `Speaker ${index + 1}`;
    default:
      return `Device ${index + 1}`;
  }
}

function DeviceHealthPill({ ready }: { ready: boolean }) {
  if (ready) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Mic ready
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      Mic blocked
    </span>
  );
}

function DeviceSelect({
  icon,
  label,
  value,
  devices,
  onChange,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  devices: MediaDeviceInfo[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const options: SelectInputOption[] =
    devices.length === 0
      ? [{ value: "", label: "No devices detected" }]
      : devices.map((device, index) => ({
          value: device.deviceId,
          label: getDeviceLabel(device, index),
        }));

  return (
    <label className="block space-y-2">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#334063]">
        {icon}
        {label}
      </span>
      <SelectInput
        value={value}
        options={options}
        dropdownLabel={label}
        onChange={onChange}
        disabled={disabled || devices.length === 0}
        triggerClassName="h-12 rounded-2xl border-[rgba(111,123,176,0.18)] px-4 py-3 text-[#2f3655] disabled:bg-[#f4f6fc] disabled:text-[#8b93b5]"
      />
    </label>
  );
}

export function CallDeviceSettingsModal({
  isOpen,
  title,
  isChecking,
  microphoneReady,
  detailMessage,
  audioInputs,
  audioOutputs,
  selectedAudioInputId,
  selectedAudioOutputId,
  onSelectAudioInput,
  onSelectAudioOutput,
  onRefresh,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  isChecking: boolean;
  microphoneReady: boolean;
  detailMessage: string | null;
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedAudioInputId: string;
  selectedAudioOutputId: string;
  onSelectAudioInput: (value: string) => void;
  onSelectAudioOutput: (value: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(8,12,22,0.58)] px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[30px] border border-[rgba(111,123,176,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,248,255,0.98)_100%)] p-6 text-[#2f3655] shadow-[0_28px_80px_rgba(20,28,54,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(96,91,255,0.08)] text-[var(--accent)]">
              <Mic className="h-6 w-6" />
            </div>

            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#6f789d]">Call settings</p>
              <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[#2f3655]">Check your microphone</h2>
              <p className="mt-3 max-w-[420px] text-sm leading-6 text-[#6f789d]">
                {title} will keep using your selected devices. Update microphone or speaker any time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(111,123,176,0.14)] bg-white/80 text-[#5c658a] transition hover:border-[rgba(96,91,255,0.28)] hover:text-[var(--accent)]"
            aria-label="Close call settings"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <DeviceHealthPill ready={microphoneReady} />

          <button
            type="button"
            onClick={onRefresh}
            disabled={isChecking}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#556080] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking ? "Refreshing..." : "Refresh devices"}
          </button>
        </div>

        {detailMessage ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {detailMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          <DeviceSelect
            icon={<Mic className="h-4 w-4 text-[var(--accent)]" />}
            label="Microphone"
            value={selectedAudioInputId}
            devices={audioInputs}
            onChange={onSelectAudioInput}
          />

          <DeviceSelect
            icon={<Headphones className="h-4 w-4 text-[var(--accent)]" />}
            label="Speaker"
            value={selectedAudioOutputId}
            devices={audioOutputs}
            onChange={onSelectAudioOutput}
          />
        </div>

        <div className="mt-6 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_28px_rgba(96,91,255,0.18)] transition hover:brightness-105"
          >
            Use these devices
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#7c86ad]">
          Speaker selection works where the browser supports output switching. Otherwise your default system speaker will be used.
        </p>
      </div>
    </div>
  );
}
