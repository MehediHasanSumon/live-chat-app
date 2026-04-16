import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

function toRemotePattern(rawUrl: string | undefined): RemotePattern | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const protocol = parsed.protocol === "https:" ? "https" : parsed.protocol === "http:" ? "http" : null;

    if (!protocol) {
      return null;
    }

    return {
      protocol,
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
    };
  } catch {
    return null;
  }
}

const configuredRemotePatterns: RemotePattern[] = [
  { protocol: "http", hostname: "localhost", port: "8000" },
  { protocol: "http", hostname: "api.localhost" },
  { protocol: "http", hostname: "localhost", port: "3000" },
  { protocol: "https", hostname: "localhost" },
  toRemotePattern(process.env.NEXT_PUBLIC_APP_URL),
  toRemotePattern(process.env.NEXT_PUBLIC_API_BASE_URL),
]
  .filter((pattern): pattern is RemotePattern => Boolean(pattern))
  .filter(
    (pattern, index, patterns) =>
      patterns.findIndex(
        (candidate) =>
          candidate.protocol === pattern.protocol &&
          candidate.hostname === pattern.hostname &&
          (candidate.port ?? "") === (pattern.port ?? ""),
      ) === index,
  );

const nextConfig: NextConfig = {
  output: "standalone",

  // Enable GZIP compression for responses
  compress: true,

  // Image optimization configuration
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: configuredRemotePatterns,
    // Use default loader for local development, can be replaced with CDN
    unoptimized: process.env.NODE_ENV === "development",
  },

  // HTTP cache headers for static assets
  async headers() {
    return [
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
      {
        source: "/public/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ["@livekit/components-react", "lucide-react"],
  },
};

export default nextConfig;
