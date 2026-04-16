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
type ConnectionState = string | null;

export function isRealtimeConfigured(): boolean {
  return REVERB_APP_KEY.trim().length > 0;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`));

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

  const socketId = getSocketId();

  if (socketId) {
    headers["X-Socket-Id"] = socketId;
  }

  return headers;
}

type BroadcastAuthPayload = {
  auth?: string;
  channel_data?: string;
};

type ResolvedBroadcastAuthPayload = {
  auth: string;
  channel_data?: string;
};

async function parseBroadcastAuthResponse(response: Response): Promise<BroadcastAuthPayload | null> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null) as Promise<BroadcastAuthPayload | null>;
  }

  const text = await response.text().catch(() => "");

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as BroadcastAuthPayload;
  } catch {
    return null;
  }
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
    // Connection pooling and optimization settings
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionDelayBackoff: 2,
    activityTimeout: 120000, // 2 minutes
    pongTimeout: 30000, // 30 seconds
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

          const data = await parseBroadcastAuthResponse(response);

          if (!response.ok) {
            callback(
              new Error(
                typeof data?.auth === "string"
                  ? "Broadcast authorization failed."
                  : "Broadcast authorization failed.",
              ),
              null,
            );
            return;
          }

          if (!data?.auth) {
            callback(new Error("Broadcast authorization payload was invalid."), null);
            return;
          }

          if (channel.name.startsWith("presence-") && !data.channel_data) {
            callback(new Error("Presence authorization payload was incomplete."), null);
            return;
          }

          const authorizationData: ResolvedBroadcastAuthPayload = {
            auth: data.auth,
            ...(data.channel_data ? { channel_data: data.channel_data } : {}),
          };

          callback(null, authorizationData);
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

export function getRealtimeConnectionState(): ConnectionState {
  return echoInstance?.connector?.pusher?.connection.state ?? null;
}

export function isRealtimeConnected(): boolean {
  return getRealtimeConnectionState() === "connected";
}

export function subscribeToRealtimeConnectionState(
  listener: (state: ConnectionState) => void,
): () => void {
  const echo = getEchoInstance();
  const connection = echo?.connector?.pusher?.connection;

  if (!connection) {
    listener(null);

    return () => {};
  }

  const handleStateChange = (payload: { current: string }) => {
    listener(payload.current);
  };

  listener(connection.state ?? null);
  connection.bind("state_change", handleStateChange);

  return () => {
    connection.unbind("state_change", handleStateChange);
  };
}

export function getSocketId(): string | null {
  const socketId = echoInstance?.connector?.pusher?.connection.socket_id;

  return typeof socketId === "string" && socketId.length > 0 ? socketId : null;
}

export function disconnectEcho(): void {
  if (!echoInstance) {
    return;
  }

  echoInstance.disconnect();
  echoInstance = null;
}
