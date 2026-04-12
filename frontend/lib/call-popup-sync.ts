"use client";

const CALL_POPUP_CHANNEL_NAME = "chat-app:audio-call-popup";
const CALL_POPUP_STORAGE_KEY = "chat-app:audio-call-popup-signal";
const CALL_POPUP_MESSAGE_KEY = "__chatAppCallPopupSignal";

export type CallPopupSignal = {
  type: "popup-closing";
  roomUuid: string;
  conversationId?: string | number | null;
  reason: string;
  sentAt: number;
  source: string;
};

let sourceId: string | null = null;

function getSourceId(): string {
  if (sourceId) {
    return sourceId;
  }

  sourceId = `window-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  return sourceId;
}

function isCallPopupSignal(value: unknown): value is CallPopupSignal {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CallPopupSignal>;

  return (
    candidate.type === "popup-closing" &&
    typeof candidate.roomUuid === "string" &&
    candidate.roomUuid.length > 0 &&
    typeof candidate.reason === "string" &&
    typeof candidate.sentAt === "number" &&
    typeof candidate.source === "string"
  );
}

export function publishPopupClosingSignal(options: {
  roomUuid: string;
  conversationId?: string | number | null;
  reason?: string;
}) {
  if (typeof window === "undefined" || !options.roomUuid) {
    return;
  }

  const signal: CallPopupSignal = {
    type: "popup-closing",
    roomUuid: options.roomUuid,
    conversationId: options.conversationId ?? null,
    reason: options.reason ?? "audio_popup_closed",
    sentAt: Date.now(),
    source: getSourceId(),
  };

  try {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(CALL_POPUP_CHANNEL_NAME);
      channel.postMessage(signal);
      channel.close();
    }
  } catch {
    // Ignore browser BroadcastChannel failures.
  }

  try {
    window.localStorage.setItem(CALL_POPUP_STORAGE_KEY, JSON.stringify(signal));
    window.localStorage.removeItem(CALL_POPUP_STORAGE_KEY);
  } catch {
    // Ignore storage failures in private browsing modes.
  }

  try {
    window.opener?.postMessage(
      {
        [CALL_POPUP_MESSAGE_KEY]: signal,
      },
      window.location.origin,
    );
  } catch {
    // Ignore opener messaging failures when no opener is available.
  }
}

export function listenToPopupClosingSignals(handler: (signal: CallPopupSignal) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const currentSource = getSourceId();

  const onSignal = (candidate: unknown) => {
    if (!isCallPopupSignal(candidate) || candidate.source === currentSource) {
      return;
    }

    handler(candidate);
  };

  let channel: BroadcastChannel | null = null;

  try {
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(CALL_POPUP_CHANNEL_NAME);
      channel.onmessage = (event) => {
        onSignal(event.data);
      };
    }
  } catch {
    channel = null;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== CALL_POPUP_STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      onSignal(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed storage payloads.
    }
  };

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    const signal = (event.data as Record<string, unknown> | null)?.[CALL_POPUP_MESSAGE_KEY];
    onSignal(signal);
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener("message", handleMessage);

  return () => {
    channel?.close();
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("message", handleMessage);
  };
}
