import { ReactNode } from "react";

import { ProtectedRouteGuard } from "@/components/auth/protected-route-guard";

type MessagesLayoutProps = {
  children: ReactNode;
};

export default function MessagesLayout({ children }: MessagesLayoutProps) {
  return <ProtectedRouteGuard>{children}</ProtectedRouteGuard>;
}
