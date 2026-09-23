import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  reactStrictMode: true,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  poweredByHeader: false,
  images: {
    // Responsive variants of the bundled 3840px WebP portraits are served
    // through the self-hosted Next.js image optimizer; no third-party CDN.
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1600],
    imageSizes: [64, 96, 192, 384],
    formats: ["image/webp"],
    qualities: [75],
  },
  experimental: {
    optimizePackageImports: ["motion"],
  },
};

export default nextConfig;
