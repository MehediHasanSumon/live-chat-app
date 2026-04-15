import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Monthly Statements");

export default function MonthlyStatementsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
