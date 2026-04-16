"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useAuthStore } from "@/lib/stores/auth-store";

export function AuthStoreSync() {
  const { data, isError, isFetched, isPending } = useAuthMeQuery(true);
  const {
    setAuthenticated,
    clearAuthenticated,
  } = useAuthStore(useShallow((state) => ({
    setAuthenticated: state.setAuthenticated,
    clearAuthenticated: state.clearAuthenticated,
  })));

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (data?.authenticated && data.data.user) {
      setAuthenticated({
        user: data.data.user,
        settings: data.data.settings,
      });
      return;
    }

    if (isFetched && (isError || data?.authenticated === false || !data?.data.user)) {
      clearAuthenticated();
    }
  }, [clearAuthenticated, data, isError, isFetched, isPending, setAuthenticated]);

  return null;
}
