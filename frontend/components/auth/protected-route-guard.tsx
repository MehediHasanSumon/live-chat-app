"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { hasSessionHint, setUnauthenticatedHandler } from "@/lib/api-client";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";

type ProtectedRouteGuardProps = {
  children: ReactNode;
  redirectTo?: string;
};

export function ProtectedRouteGuard({
  children,
  redirectTo = "/login",
}: ProtectedRouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError } = useAuthMeQuery(true);

  const hasSession = hasSessionHint();
  const isAuthenticated = Boolean(data?.data.user);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      router.replace(redirectTo);
    });

    return () => {
      setUnauthenticatedHandler(null);
    };
  }, [redirectTo, router]);

  useEffect(() => {
    if (!isLoading && isError && pathname !== redirectTo) {
      router.replace(redirectTo);
    }
  }, [isError, isLoading, pathname, redirectTo, router]);

  if (isAuthenticated || (hasSession && (isLoading || !isError))) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return null;
  }
}
