import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Edit Invoice");

export default function EditInvoiceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
