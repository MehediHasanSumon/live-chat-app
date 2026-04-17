import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Invoice SMS Templates");

export default function InvoiceSmsTemplatesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
