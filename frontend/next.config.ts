import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Step 3 keeps role photography inside the app instead of relying on
    // external runtime rewrites. Assets are local 3840px WebP sources.
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["motion"],
  },
};

export default nextConfig;
