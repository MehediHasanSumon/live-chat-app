"use client";

export type CallWindowAction = "start" | "accept" | "join";
export type CallWindowMediaType = "voice" | "video";

type OpenCallWindowOptions = {
  conversationId: string | number;
  action: CallWindowAction;
  mediaType?: CallWindowMediaType;
  roomUuid?: string;
  title?: string;
  avatarUrl?: string | null;
  targetUserId?: number | null;
  isGroup?: boolean;
};

function buildCallUrl({
  conversationId,
  action,
  mediaType = "voice",
  roomUuid,
  title,
  avatarUrl,
  targetUserId,
  isGroup,
}: OpenCallWindowOptions): string {
  const params = new URLSearchParams({
    conversationId: String(conversationId),
    action,
    mediaType,
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

  return `/calls/room?${params.toString()}`;
}

export function openCallWindow(options: OpenCallWindowOptions): Window | null {
  if (typeof window === "undefined") {
    return null;
  }

  const mediaType = options.mediaType ?? "voice";
  const width = mediaType === "video" ? 1280 : 460;
  const height = mediaType === "video" ? 860 : 760;
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
  const target = `call-${mediaType}-${options.conversationId}`;
  const url = buildCallUrl(options);
  const popup = window.open(url, target, features) ?? window.open(url, "_blank");

  if (!popup) {
    window.location.assign(url);
    return null;
  }

  popup.focus();

  return popup;
}

export function openAudioCallWindow(options: Omit<OpenCallWindowOptions, "mediaType">): Window | null {
  return openCallWindow({
    ...options,
    mediaType: "voice",
  });
}

export function openVideoCallWindow(options: Omit<OpenCallWindowOptions, "mediaType">): Window | null {
  return openCallWindow({
    ...options,
    mediaType: "video",
  });
}
