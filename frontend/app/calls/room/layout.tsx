import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Call Room");

export default function CallRoomLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
