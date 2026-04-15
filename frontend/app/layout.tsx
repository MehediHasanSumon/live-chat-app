import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { PerformanceInitializer } from "@/components/providers/performance-initializer";
import { APP_NAME } from "@/lib/page-metadata";

import "@livekit/components-styles";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "Auth and messenger interface for a realtime chat platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${poppins.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <PerformanceInitializer />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
