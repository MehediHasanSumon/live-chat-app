import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Blocked Accounts");

export default function BlockedAccountsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
