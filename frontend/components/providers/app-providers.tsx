"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { ReactNode, Suspense, useState } from "react";

import { AuthQuerySync } from "@/components/providers/auth-query-sync";
import { AuthStoreSync } from "@/components/providers/auth-store-sync";
import { CallDock } from "@/components/providers/call-dock";
import { CallRealtimeProvider } from "@/components/providers/call-realtime-provider";
import { ConversationRealtimeProvider } from "@/components/providers/conversation-realtime-provider";
import { EmailVerificationGate } from "@/components/providers/email-verification-gate";
import { MessengerToastProvider } from "@/components/providers/messenger-toast-provider";
import { PresenceHeartbeatProvider } from "@/components/providers/presence-heartbeat-provider";
import { ReverbProvider } from "@/components/providers/reverb-provider";
import { ToastViewport } from "@/components/providers/toast-viewport";

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
      <MessengerToastProvider />
      {!isStandaloneAudioCallRoute ? <CallDock /> : null}
      <Suspense fallback={null}>
        <EmailVerificationGate>{children}</EmailVerificationGate>
      </Suspense>
      <ToastViewport />
    </QueryClientProvider>
  );
}
