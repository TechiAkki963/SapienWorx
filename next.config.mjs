/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces the minimal server.js bundle used by the production Docker image.
  output: "standalone",
};

export default nextConfig;
