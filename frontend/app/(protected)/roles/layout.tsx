import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Roles");

export default function RolesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
