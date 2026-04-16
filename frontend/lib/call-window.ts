"use client";

import { ensureCallLaunchDeviceReadiness } from "@/lib/call-device";
import { pushToast } from "@/lib/stores/toast-store";

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

export async function openCallWindow(options: OpenCallWindowOptions): Promise<Window | null> {
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
  const popup = window.open("about:blank", target, features) ?? window.open("about:blank", "_blank");

  if (!popup) {
    try {
      await ensureCallLaunchDeviceReadiness({
        requestedMediaType: mediaType,
      });
      window.location.assign(url);
      return null;
    } catch (error) {
      pushToast({
        kind: "crud",
        tone: "error",
        title: "Microphone unavailable",
        message: error instanceof Error ? error.message : "No default microphone is available for this call.",
      });

      return null;
    }
  }

  try {
    await ensureCallLaunchDeviceReadiness({
      requestedMediaType: mediaType,
    });
    popup.location.replace(url);
    popup.focus();
  } catch (error) {
    popup.close();
    pushToast({
      kind: "crud",
      tone: "error",
      title: "Microphone unavailable",
      message: error instanceof Error ? error.message : "No default microphone is available for this call.",
    });

    return null;
  }

  return popup;
}

export function openAudioCallWindow(options: Omit<OpenCallWindowOptions, "mediaType">) {
  return openCallWindow({
    ...options,
    mediaType: "voice",
  });
}

export function openVideoCallWindow(options: Omit<OpenCallWindowOptions, "mediaType">) {
  return openCallWindow({
    ...options,
    mediaType: "video",
  });
}
