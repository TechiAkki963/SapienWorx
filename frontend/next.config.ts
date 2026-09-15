import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Human-led brand imagery is committed under /public and should be served
    // directly. This avoids deployment-specific image-optimizer failures that
    // can leave the layout visible while the actual people images are blank.
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["motion"],
  },
};

export default nextConfig;
