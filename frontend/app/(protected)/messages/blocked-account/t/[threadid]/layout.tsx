import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Blocked Conversation");

export default function BlockedConversationLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
