"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const REVERB_APP_KEY = process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? "";
const REVERB_HOST = process.env.NEXT_PUBLIC_REVERB_HOST ?? "localhost";
const REVERB_PORT = Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080);
const REVERB_SCHEME = process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "http";
const REVERB_PATH = process.env.NEXT_PUBLIC_REVERB_PATH ?? "";

let echoInstance: Echo<"reverb"> | null = null;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=")[1] ?? "") : null;
}

function buildAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const token = getCookie("XSRF-TOKEN");

  if (token) {
    headers["X-XSRF-TOKEN"] = token;
  }

  return headers;
}

function createEchoInstance(): Echo<"reverb"> | null {
  if (typeof window === "undefined" || !REVERB_APP_KEY) {
    return null;
  }

  (globalThis as typeof globalThis & { Pusher?: typeof Pusher }).Pusher = Pusher;

  return new Echo({
    broadcaster: "reverb",
    key: REVERB_APP_KEY,
    wsHost: REVERB_HOST,
    wsPort: REVERB_PORT,
    wssPort: REVERB_PORT,
    forceTLS: REVERB_SCHEME === "https",
    enabledTransports: ["ws", "wss"],
    authEndpoint: `${API_BASE_URL}/broadcasting/auth`,
    ...(REVERB_PATH ? { wsPath: REVERB_PATH } : {}),
    authorizer: (channel) => ({
      authorize: async (socketId, callback) => {
        try {
          const response = await fetch(`${API_BASE_URL}/broadcasting/auth`, {
            method: "POST",
            credentials: "include",
            headers: buildAuthHeaders(),
            body: JSON.stringify({
              socket_id: socketId,
              channel_name: channel.name,
            }),
          });

          const data = await response.json().catch(() => null);

          if (!response.ok) {
            callback(data ?? new Error("Broadcast authorization failed."), null);
            return;
          }

          callback(null, data);
        } catch (error) {
          callback(error as Error, null);
        }
      },
    }),
  });
}

export function getEchoInstance(): Echo<"reverb"> | null {
  if (!echoInstance) {
    echoInstance = createEchoInstance();
  }

  return echoInstance;
}

export function connectEcho(): Echo<"reverb"> | null {
  const echo = getEchoInstance();

  if (!echo) {
    return null;
  }

  echo.connector.pusher.connect();

  return echo;
}

export function disconnectEcho(): void {
  if (!echoInstance) {
    return;
  }

  echoInstance.disconnect();
  echoInstance = null;
}
