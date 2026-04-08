"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

import { AuthQuerySync } from "@/components/providers/auth-query-sync";
import { CallDock } from "@/components/providers/call-dock";
import { CallRoomOverlay } from "@/components/providers/call-room-overlay";
import { CallRealtimeProvider } from "@/components/providers/call-realtime-provider";
import { NavigationProgress } from "@/components/providers/navigation-progress";
import { ReverbProvider } from "@/components/providers/reverb-provider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationProgress />
      <AuthQuerySync />
      <ReverbProvider />
      <CallRealtimeProvider />
      <CallDock />
      <CallRoomOverlay />
      {children}
    </QueryClientProvider>
  );
}
