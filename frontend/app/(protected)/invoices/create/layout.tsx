import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Create Invoice");

export default function CreateInvoiceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
