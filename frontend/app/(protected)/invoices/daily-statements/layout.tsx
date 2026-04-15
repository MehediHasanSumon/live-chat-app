import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Daily Statements");

export default function DailyStatementsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
