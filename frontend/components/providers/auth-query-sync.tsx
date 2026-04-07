"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryKeys } from "@/lib/query-keys";

export function AuthQuerySync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function refetchAuthState() {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.auth.me,
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refetchAuthState();
      }
    }

    window.addEventListener("pageshow", refetchAuthState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", refetchAuthState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryClient]);

  return null;
}
