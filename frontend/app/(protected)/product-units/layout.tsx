import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Product Units");

export default function ProductUnitsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
