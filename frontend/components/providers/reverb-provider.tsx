"use client";

import { useEffect } from "react";

import { connectEcho, disconnectEcho } from "@/lib/reverb";
import { useAuthStore } from "@/lib/stores/auth-store";

export function ReverbProvider() {
  const userId = useAuthStore((state) => state.user?.id ?? null);

  useEffect(() => {
    if (!userId) {
      disconnectEcho();
      return;
    }

    const echo = connectEcho();

    return () => {
      if (!echo) {
        return;
      }

      disconnectEcho();
    };
  }, [userId]);

  return null;
}
