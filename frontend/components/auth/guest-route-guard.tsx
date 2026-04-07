"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { hasSessionHint } from "@/lib/api-client";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";

type GuestRouteGuardProps = {
  children: ReactNode;
  redirectTo?: string;
};

export function GuestRouteGuard({
  children,
  redirectTo = "/messages",
}: GuestRouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading } = useAuthMeQuery(true);

  const hasSession = hasSessionHint();
  const isAuthenticated = Boolean(data?.data.user);

  useEffect(() => {
    if (isAuthenticated && pathname !== redirectTo) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, pathname, redirectTo, router]);

  if (isAuthenticated || (hasSession && isLoading)) {
    return null;
  }

  return <>{children}</>;
}
