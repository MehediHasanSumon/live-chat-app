import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Customers");

export default function CustomersLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
