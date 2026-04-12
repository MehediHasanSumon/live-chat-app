"use client";

type AudioCallWindowAction = "start" | "accept" | "join";

type OpenAudioCallWindowOptions = {
  conversationId: string | number;
  action: AudioCallWindowAction;
  roomUuid?: string;
};

function buildAudioCallUrl({ conversationId, action, roomUuid }: OpenAudioCallWindowOptions): string {
  const params = new URLSearchParams({
    conversationId: String(conversationId),
    action,
  });

  if (roomUuid) {
    params.set("roomUuid", roomUuid);
  }

  return `/calls/audio?${params.toString()}`;
}

export function openAudioCallWindow(options: OpenAudioCallWindowOptions): Window | null {
  if (typeof window === "undefined") {
    return null;
  }

  const width = 460;
  const height = 760;
  const left = Math.max(Math.round(window.screenX + (window.outerWidth - width) / 2), 0);
  const top = Math.max(Math.round(window.screenY + (window.outerHeight - height) / 2), 0);
  const features = [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=no",
  ].join(",");
  const target = `audio-call-${options.conversationId}`;
  const url = buildAudioCallUrl(options);
  const popup = window.open(url, target, features) ?? window.open(url, "_blank");

  popup?.focus();

  return popup;
}
