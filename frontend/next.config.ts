import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Enable GZIP compression for responses
  compress: true,

  // Image optimization configuration
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
      },
      {
        protocol: "http",
        hostname: "api.localhost",
      },
      {
        protocol: "http",
        hostname: process.env.NEXT_PUBLIC_API_HOST || "localhost",
      },
    ],
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
