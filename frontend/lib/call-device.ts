"use client";

export const AUDIO_INPUT_PREFERENCE_KEY = "chat-app:call-audio-input-id";
export const VIDEO_INPUT_PREFERENCE_KEY = "chat-app:call-video-input-id";
export const AUDIO_OUTPUT_PREFERENCE_KEY = "chat-app:call-audio-output-id";

export type CallDeviceSnapshot = {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedAudioInputId: string;
  selectedVideoInputId: string;
  selectedAudioOutputId: string;
  microphoneReady: boolean;
  cameraReady: boolean;
  detailMessage: string | null;
};

function preferDefaultDevice(devices: MediaDeviceInfo[]): string {
  return (
    devices.find((device) => device.deviceId === "default")?.deviceId ??
    devices.find((device) => device.label.toLowerCase().startsWith("default"))?.deviceId ??
    devices[0]?.deviceId ??
    ""
  );
}

export function readStoredDevicePreference(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(key) ?? "";
}

export function writeStoredDevicePreference(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!value) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, value);
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

export function formatDeviceAccessMessage(error: unknown, fallbackToAudioAvailable = false): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return fallbackToAudioAvailable
        ? "Camera access was blocked. You can still continue with audio only."
        : "Microphone access was blocked. Please allow microphone permission and try again.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return fallbackToAudioAvailable
        ? "We could not find a camera. You can still continue with audio only."
        : "No default microphone was found for this call.";
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackToAudioAvailable
    ? "Camera access is unavailable right now. You can still continue with audio only."
    : "We could not prepare your call devices right now.";
}

function pickDeviceId(
  devices: MediaDeviceInfo[],
  preferredId: string,
  fallbackId?: string | null,
): string {
  const candidateIds = [preferredId, fallbackId ?? "", preferDefaultDevice(devices)].filter(
    (value, index, values) => value.trim().length > 0 && values.indexOf(value) === index,
  );

  for (const candidateId of candidateIds) {
    if (devices.some((device) => device.deviceId === candidateId)) {
      return candidateId;
    }
  }

  return preferDefaultDevice(devices);
}

export async function inspectCallDevices(options: {
  requestedMediaType: "voice" | "video";
  preferredAudioInputId?: string;
  preferredAudioOutputId?: string;
  preferredVideoInputId?: string;
}): Promise<CallDeviceSnapshot> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia ||
    !navigator.mediaDevices.enumerateDevices
  ) {
    return {
      audioInputs: [],
      videoInputs: [],
      audioOutputs: [],
      selectedAudioInputId: "",
      selectedVideoInputId: "",
      selectedAudioOutputId: "",
      microphoneReady: false,
      cameraReady: options.requestedMediaType !== "video",
      detailMessage: "This browser cannot inspect your call devices.",
    };
  }

  let requestedStream: MediaStream | null = null;
  let audioOnlyStream: MediaStream | null = null;
  let primaryError: unknown = null;

  try {
    try {
      requestedStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: options.requestedMediaType === "video",
      });
    } catch (error) {
      primaryError = error;

      if (options.requestedMediaType === "video") {
        audioOnlyStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } else {
        throw error;
      }
    }

    const grantedStream = requestedStream ?? audioOnlyStream;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((device) => device.kind === "audioinput");
    const videoInputs = devices.filter((device) => device.kind === "videoinput");
    const audioOutputs = devices.filter((device) => device.kind === "audiooutput");
    const audioTrack = grantedStream?.getAudioTracks()[0] ?? null;

    const selectedAudioInputId = pickDeviceId(
      audioInputs,
      options.preferredAudioInputId ?? "",
      audioTrack?.getSettings().deviceId,
    );
    const selectedVideoInputId = pickDeviceId(videoInputs, options.preferredVideoInputId ?? "");
    const selectedAudioOutputId = pickDeviceId(audioOutputs, options.preferredAudioOutputId ?? "");
    const microphoneReady = Boolean(grantedStream?.getAudioTracks().length) && selectedAudioInputId.trim().length > 0;
    const cameraReady =
      options.requestedMediaType === "video"
        ? Boolean(requestedStream?.getVideoTracks().length)
        : true;

    return {
      audioInputs,
      videoInputs,
      audioOutputs,
      selectedAudioInputId,
      selectedVideoInputId,
      selectedAudioOutputId,
      microphoneReady,
      cameraReady,
      detailMessage: primaryError
        ? formatDeviceAccessMessage(primaryError, options.requestedMediaType === "video")
        : options.requestedMediaType === "video" && !cameraReady
          ? "Camera access is unavailable. You will join with microphone only."
          : null,
    };
  } finally {
    stopMediaStream(requestedStream);
    stopMediaStream(audioOnlyStream);
  }
}

export async function ensureCallLaunchDeviceReadiness(options: {
  requestedMediaType: "voice" | "video";
  preferredAudioInputId?: string;
  preferredAudioOutputId?: string;
  preferredVideoInputId?: string;
}) {
  const snapshot = await inspectCallDevices(options);

  if (!snapshot.microphoneReady || !snapshot.selectedAudioInputId) {
    throw new Error(snapshot.detailMessage ?? "No default microphone is available for this call.");
  }

  writeStoredDevicePreference(AUDIO_INPUT_PREFERENCE_KEY, snapshot.selectedAudioInputId);
  writeStoredDevicePreference(AUDIO_OUTPUT_PREFERENCE_KEY, snapshot.selectedAudioOutputId);
  writeStoredDevicePreference(VIDEO_INPUT_PREFERENCE_KEY, snapshot.selectedVideoInputId);

  return snapshot;
}

export function buildCallDevicePayload(snapshot: {
  selectedAudioInputId: string;
  selectedAudioOutputId?: string;
}) {
  return {
    device_ready: true as const,
    audio_input_device_id: snapshot.selectedAudioInputId,
    ...(snapshot.selectedAudioOutputId
      ? { audio_output_device_id: snapshot.selectedAudioOutputId }
      : {}),
  };
}
