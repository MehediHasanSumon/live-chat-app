import type { Metadata } from "next";

export const APP_NAME = process.env.APP_NAME || "Nexus";

export function pageMetadata(title: string): Metadata {
  return {
    title,
  };
}
