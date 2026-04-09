"use client";

import { ReactNode } from "react";

import { useAuthStore } from "@/lib/stores/auth-store";

type AuthProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function Auth({ children, fallback = null }: AuthProps) {
  const user = useAuthStore((state) => state.user);

  return user ? <>{children}</> : <>{fallback}</>;
}
