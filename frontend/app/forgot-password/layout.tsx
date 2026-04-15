import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Forgot Password");

export default function ForgotPasswordLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
