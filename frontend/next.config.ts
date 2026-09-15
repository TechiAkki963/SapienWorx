import type { NextConfig } from "next";

// Public/auth brand photography is intentionally requested at a large source size
// because these assets are displayed in large editorial crops and on HiDPI screens.
const candidatePortrait = "https://images.unsplash.com/photo-1758691737605-69a0e78bd193?auto=format&fit=crop&fm=jpg&q=95&w=3200";
const recruiterPortrait = "https://images.unsplash.com/photo-1758518730327-98070967caab?auto=format&fit=crop&fm=jpg&q=95&w=3200";
const workplacePortrait = "https://images.unsplash.com/photo-1758518730380-04c8e0d57b68?auto=format&fit=crop&fm=jpg&q=95&w=3200";
const employerPortrait = "https://images.unsplash.com/photo-1742119971773-57e0131095b0?auto=format&fit=crop&fm=jpg&q=95&w=3200";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Serve the explicitly-sized high-resolution source without another lossy
    // optimization pass. Public/auth imagery is intentionally kept out of the
    // authenticated product tools.
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
