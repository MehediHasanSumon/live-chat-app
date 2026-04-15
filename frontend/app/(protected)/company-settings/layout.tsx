import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Company Settings");

export default function CompanySettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
