import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Archived Chats");

export default function ArchivedChatsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
