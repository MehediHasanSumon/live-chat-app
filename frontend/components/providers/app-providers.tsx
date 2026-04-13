"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

import { AuthQuerySync } from "@/components/providers/auth-query-sync";
import { AuthStoreSync } from "@/components/providers/auth-store-sync";
import { CallDock } from "@/components/providers/call-dock";
import { CallRealtimeProvider } from "@/components/providers/call-realtime-provider";
import { ConversationRealtimeProvider } from "@/components/providers/conversation-realtime-provider";
import { PresenceHeartbeatProvider } from "@/components/providers/presence-heartbeat-provider";
import { ReverbProvider } from "@/components/providers/reverb-provider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const pathname = usePathname();
  const isStandaloneAudioCallRoute = pathname?.startsWith("/calls/");
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
      <AuthQuerySync />
      <AuthStoreSync />
      <PresenceHeartbeatProvider />
      <ReverbProvider />
      <CallRealtimeProvider />
      <ConversationRealtimeProvider />
      {!isStandaloneAudioCallRoute ? <CallDock /> : null}
      {children}
    </QueryClientProvider>
  );
}
