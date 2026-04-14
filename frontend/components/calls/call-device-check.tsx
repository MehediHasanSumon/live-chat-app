"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Headphones, Mic, Video } from "lucide-react";

function getDeviceLabel(device: MediaDeviceInfo, index: number): string {
  if (device.label.trim().length > 0) {
    return device.label;
  }

  switch (device.kind) {
    case "audioinput":
      return `Microphone ${index + 1}`;
    case "videoinput":
      return `Camera ${index + 1}`;
    case "audiooutput":
      return `Speaker ${index + 1}`;
    default:
      return `Device ${index + 1}`;
  }
}

function DeviceHealthPill({
  label,
  ready,
  optional = false,
}: {
  label: string;
  ready: boolean;
  optional?: boolean;
}) {
  if (ready) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {label} ready
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      {optional ? `${label} optional` : `${label} blocked`}
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
  return (
    <label className="block space-y-2">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#334063]">
        {icon}
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        disabled={disabled || devices.length === 0}
        className="w-full rounded-2xl border border-[rgba(111,123,176,0.18)] bg-white px-4 py-3 text-sm text-[#2f3655] outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[#f4f6fc] disabled:text-[#8b93b5]"
      >
        {devices.length === 0 ? <option value="">No devices detected</option> : null}
        {devices.map((device, index) => (
          <option key={`${device.kind}-${device.deviceId || index}`} value={device.deviceId}>
            {getDeviceLabel(device, index)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CallDeviceCheck({
  title,
  requestedMediaType,
  selectedMediaType,
  isChecking,
  microphoneReady,
  cameraReady,
  detailMessage,
  audioInputs,
  videoInputs,
  audioOutputs,
  selectedAudioInputId,
  selectedVideoInputId,
  selectedAudioOutputId,
  onSelectAudioInput,
  onSelectVideoInput,
  onSelectAudioOutput,
  onContinue,
  onContinueAudioOnly,
}: {
  title: string;
  requestedMediaType: "voice" | "video";
  selectedMediaType: "voice" | "video";
  isChecking: boolean;
  microphoneReady: boolean;
  cameraReady: boolean;
  detailMessage: string | null;
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedAudioInputId: string;
  selectedVideoInputId: string;
  selectedAudioOutputId: string;
  onSelectAudioInput: (value: string) => void;
  onSelectVideoInput: (value: string) => void;
  onSelectAudioOutput: (value: string) => void;
  onContinue: () => void;
  onContinueAudioOnly?: () => void;
}) {
  const isVideoRequested = requestedMediaType === "video";
  const isAudioFallback = isVideoRequested && selectedMediaType === "voice";

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-6">
      <div className="w-full max-w-[620px] overflow-hidden rounded-[32px] border border-[rgba(111,123,176,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,248,255,0.98)_100%)] p-6 text-[#2f3655] shadow-[0_28px_80px_rgba(96,109,160,0.18)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(96,91,255,0.08)] text-[var(--accent)]">
              {selectedMediaType === "video" ? <Video className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </div>

            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#6f789d]">Pre-call check</p>
              <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[#2f3655]">
                {isAudioFallback ? "Joining without camera" : `Check your ${selectedMediaType === "video" ? "camera and mic" : "microphone"}`}
              </h1>
              <p className="mt-3 max-w-[460px] text-sm leading-6 text-[#6f789d]">
                {title} will open once your devices are ready. You can switch inputs before joining.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DeviceHealthPill label="Mic" ready={microphoneReady} />
            {isVideoRequested ? <DeviceHealthPill label="Camera" ready={cameraReady} optional={isAudioFallback} /> : null}
          </div>
        </div>

        {detailMessage ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {detailMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
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

          {isVideoRequested ? (
            <DeviceSelect
              icon={cameraReady ? <Camera className="h-4 w-4 text-[var(--accent)]" /> : <CameraOff className="h-4 w-4 text-[var(--accent)]" />}
              label="Camera"
              value={selectedVideoInputId}
              devices={videoInputs}
              onChange={onSelectVideoInput}
              disabled={!cameraReady && !isChecking}
            />
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {typeof onContinueAudioOnly === "function" ? (
            <button
              type="button"
              onClick={onContinueAudioOnly}
              className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              <CameraOff className="h-4 w-4" />
              Continue with audio only
            </button>
          ) : null}

          <button
            type="button"
            onClick={onContinue}
            disabled={isChecking || !microphoneReady || (selectedMediaType === "video" && !cameraReady)}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_28px_rgba(96,91,255,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {selectedMediaType === "video" ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isChecking ? "Preparing..." : `Continue to ${selectedMediaType === "video" ? "video" : "voice"} call`}
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#7c86ad]">
          Speaker selection works where the browser supports output switching. Otherwise your default system speaker will be used.
        </p>
      </div>
    </div>
  );
}
