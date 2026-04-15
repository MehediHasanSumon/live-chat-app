import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Audio Call");

export default function AudioCallLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
