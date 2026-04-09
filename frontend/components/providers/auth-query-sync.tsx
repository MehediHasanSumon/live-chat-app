"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { queryKeys } from "@/lib/query-keys";

export function AuthQuerySync() {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    function refetchAuthState() {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.auth.me,
      });
      void queryClient.refetchQueries({
        type: "active",
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refetchAuthState();
      }
    }

    function handlePageShow() {
      refetchAuthState();
      router.refresh();
    }

    function handlePopState() {
      refetchAuthState();
      router.refresh();
    }

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryClient, router]);

  return null;
}
