"use client";

import { ReactNode } from "react";

import { useAuthStore } from "@/lib/stores/auth-store";

type GuestProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function Guest({ children, fallback = null }: GuestProps) {
  const user = useAuthStore((state) => state.user);

  return user ? <>{fallback}</> : <>{children}</>;
}
