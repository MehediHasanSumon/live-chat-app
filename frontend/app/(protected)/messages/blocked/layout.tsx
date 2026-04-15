import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Blocked Accounts");

export default function BlockedRedirectLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
