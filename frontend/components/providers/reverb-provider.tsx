"use client";

import { useEffect } from "react";

import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { connectEcho, disconnectEcho } from "@/lib/reverb";

export function ReverbProvider() {
  const { data: authMe } = useAuthMeQuery(true);
  const userId = authMe?.data.user.id ?? null;

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
