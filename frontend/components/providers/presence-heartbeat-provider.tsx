"use client";

import { useEffect, useMemo, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { getPresenceDeviceUuid, notifyPresenceOfflineKeepalive } from "@/lib/presence";
import { useAuthStore } from "@/lib/stores/auth-store";

const HEARTBEAT_INTERVAL_MS = 25_000;

export function PresenceHeartbeatProvider() {
  const authUser = useAuthStore((state) => state.user);
  const [deviceUuid] = useState<string | null>(() => getPresenceDeviceUuid());

  const canHeartbeat = useMemo(() => Boolean(authUser?.id && deviceUuid), [authUser?.id, deviceUuid]);

  useEffect(() => {
    if (!canHeartbeat || !deviceUuid) {
      return;
    }

    let cancelled = false;

    const sendHeartbeat = async () => {
      if (cancelled || document.visibilityState === "hidden") {
        return;
      }

      try {
        await apiClient.post(
          "/api/presence/heartbeat",
          {
            device_uuid: deviceUuid,
          },
          {
            skipAuthRedirect: true,
          },
        );
      } catch {
        // Presence heartbeat failures should not interrupt the chat UI.
      }
    };

    void sendHeartbeat();

    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      }
    };

    const handleFocus = () => {
      void sendHeartbeat();
    };

    const handlePageHide = () => {
      notifyPresenceOfflineKeepalive();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [canHeartbeat, deviceUuid]);

  return null;
}
