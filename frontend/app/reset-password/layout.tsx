import { type ReactNode } from "react";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("Reset Password");

export default function ResetPasswordLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
