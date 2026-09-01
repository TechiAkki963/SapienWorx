/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";
const apiOrigin = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const deploymentVersion = process.env.DEPLOYMENT_VERSION?.trim() || undefined;
const scriptPolicy = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;
const nextConfig = {
  // Produces the minimal server.js bundle used by the production Docker image.
  output: "standalone",
  // Keeps rolling ECS deployments from mixing assets/server functions across versions.
  ...(deploymentVersion ? { deploymentId: deploymentVersion } : {}),
  generateBuildId: async () => deploymentVersion ?? "local-development",
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; ${scriptPolicy}; connect-src 'self' ${apiOrigin} ${apiOrigin.replace(/^http/, "ws")};` },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ...(!isDev ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }] : []),
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      ],
    }];
  },
};

export default nextConfig;
