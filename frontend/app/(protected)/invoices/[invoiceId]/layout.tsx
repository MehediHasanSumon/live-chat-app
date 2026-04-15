import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Invoice Details");

export default function InvoiceDetailsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
