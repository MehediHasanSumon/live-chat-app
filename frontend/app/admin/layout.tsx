import { ReactNode } from "react";

import { ProtectedRouteGuard } from "@/components/auth/protected-route-guard";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <ProtectedRouteGuard>{children}</ProtectedRouteGuard>;
}
