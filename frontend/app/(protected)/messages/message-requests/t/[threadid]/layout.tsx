import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Message Request");

export default function MessageRequestThreadLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
