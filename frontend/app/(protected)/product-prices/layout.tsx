import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Product Prices");

export default function ProductPricesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
