import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("User Settings");

export default function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
