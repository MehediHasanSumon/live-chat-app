"use client";

import { apiClient } from "@/lib/api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const PRESENCE_DEVICE_KEY = "chat-app:presence-device-uuid";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=")[1] ?? "") : null;
}

export function getPresenceDeviceUuid(options?: { createIfMissing?: boolean }) {
  const createIfMissing = options?.createIfMissing ?? true;

  if (typeof window === "undefined") {
    return null;
  }

  const existing = window.localStorage.getItem(PRESENCE_DEVICE_KEY);

  if (existing) {
    return existing;
  }

  if (!createIfMissing) {
    return null;
  }

  const generated = crypto.randomUUID();
  window.localStorage.setItem(PRESENCE_DEVICE_KEY, generated);

  return generated;
}

export async function notifyPresenceOffline() {
  const deviceUuid = getPresenceDeviceUuid({ createIfMissing: false });

  if (!deviceUuid) {
    return;
  }

  try {
    await apiClient.post(
      "/api/presence/offline",
      {
        device_uuid: deviceUuid,
      },
      {
        skipAuthRedirect: true,
      },
    );
  } catch {
    // Presence disconnect failures should not block normal navigation or logout.
  }
}

export function notifyPresenceOfflineKeepalive() {
  const deviceUuid = getPresenceDeviceUuid({ createIfMissing: false });

  if (!deviceUuid || typeof window === "undefined") {
    return;
  }

  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });

  const csrfToken = getCookie("XSRF-TOKEN");

  if (csrfToken) {
    headers.set("X-XSRF-TOKEN", csrfToken);
  }

  void fetch(`${API_BASE_URL}/api/presence/offline`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers,
    body: JSON.stringify({
      device_uuid: deviceUuid,
    }),
  }).catch(() => {
    // Best effort only.
  });
}
