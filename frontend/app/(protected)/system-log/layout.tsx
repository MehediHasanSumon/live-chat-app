import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("System Log");

export default function SystemLogLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
