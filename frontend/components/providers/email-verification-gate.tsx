"use client";

import { ReactNode, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";

type EmailVerificationGateProps = {
  children: ReactNode;
};

const publicAuthPaths = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);

function buildRedirectPath(pathname: string, searchParams: URLSearchParams) {
  const queryString = searchParams.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function EmailVerificationGate({ children }: EmailVerificationGateProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const { data } = useAuthMeQuery(true);
  const isVerificationPath = pathname === "/email-verification";

  const redirectTarget = useMemo(() => {
    if (!data) {
      return null;
    }

    const isAuthenticated = Boolean(data.authenticated && data.data.user);
    const mustVerifyEmail = Boolean(isAuthenticated && data.data.must_verify_email);

    if (mustVerifyEmail && !isVerificationPath) {
      const redirect = buildRedirectPath(pathname, searchParams);

      return `/email-verification?redirect=${encodeURIComponent(redirect)}`;
    }

    if (isVerificationPath && !mustVerifyEmail) {
      if (!isAuthenticated) {
        return "/login";
      }

      return searchParams.get("redirect") || "/dashboard";
    }

    if (isAuthenticated && publicAuthPaths.has(pathname) && mustVerifyEmail) {
      return "/email-verification";
    }

    return null;
  }, [data, isVerificationPath, pathname, searchParams]);

  useEffect(() => {
    if (redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [redirectTarget, router]);

  if (redirectTarget || (isVerificationPath && !data)) {
    return null;
  }

  return <>{children}</>;
}
