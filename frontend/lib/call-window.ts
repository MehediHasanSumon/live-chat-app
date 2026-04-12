"use client";

type AudioCallWindowAction = "start" | "accept" | "join";

type OpenAudioCallWindowOptions = {
  conversationId: string | number;
  action: AudioCallWindowAction;
  roomUuid?: string;
  title?: string;
  avatarUrl?: string | null;
  targetUserId?: number | null;
  isGroup?: boolean;
};

function buildAudioCallUrl({
  conversationId,
  action,
  roomUuid,
  title,
  avatarUrl,
  targetUserId,
  isGroup,
}: OpenAudioCallWindowOptions): string {
  const params = new URLSearchParams({
    conversationId: String(conversationId),
    action,
  });

  if (roomUuid) {
    params.set("roomUuid", roomUuid);
  }

  if (title) {
    params.set("title", title);
  }

  if (avatarUrl) {
    params.set("avatarUrl", avatarUrl);
  }

  if (typeof targetUserId === "number") {
    params.set("targetUserId", String(targetUserId));
  }

  if (typeof isGroup === "boolean") {
    params.set("isGroup", isGroup ? "1" : "0");
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
