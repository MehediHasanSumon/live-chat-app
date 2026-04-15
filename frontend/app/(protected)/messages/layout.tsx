import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Messages");

export default function MessagesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
