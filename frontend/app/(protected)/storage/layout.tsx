import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Storage Configuration");

export default function StorageLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
