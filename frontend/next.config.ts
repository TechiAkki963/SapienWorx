import type { NextConfig } from "next";

const candidatePortrait = "https://images.unsplash.com/photo-1758691737605-69a0e78bd193?auto=format&fit=crop&fm=jpg&q=88&w=2400";
const recruiterPortrait = "https://images.unsplash.com/photo-1758518730327-98070967caab?auto=format&fit=crop&fm=jpg&q=88&w=2400";
const workplacePortrait = "https://images.unsplash.com/photo-1758518730380-04c8e0d57b68?auto=format&fit=crop&fm=jpg&q=88&w=2400";
const employerPortrait = "https://images.unsplash.com/photo-1742119971773-57e0131095b0?auto=format&fit=crop&fm=jpg&q=88&w=2400";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    return [
      { source: "/images/people/auth-candidate.webp", destination: candidatePortrait },
      { source: "/images/people/sapien-hero-candidate.webp", destination: candidatePortrait },
      { source: "/images/people/recruiter-review.webp", destination: candidatePortrait },
      { source: "/images/people/auth-recruiter.webp", destination: recruiterPortrait },
      { source: "/images/people/sapien-recruiter.webp", destination: recruiterPortrait },
      { source: "/images/people/recruiter-team.webp", destination: workplacePortrait },
      { source: "/images/people/recruiter-workspace.webp", destination: workplacePortrait },
      { source: "/images/people/sapien-talent.webp", destination: workplacePortrait },
      { source: "/images/people/sapien-workplace.webp", destination: workplacePortrait },
      { source: "/images/people/sapien-employer.webp", destination: employerPortrait },
    ];
  },
  experimental: {
    optimizePackageImports: ["motion"],
  },
};

export default nextConfig;
