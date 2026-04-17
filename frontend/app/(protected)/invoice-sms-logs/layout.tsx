import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Invoice SMS Logs");

export default function InvoiceSmsLogsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
