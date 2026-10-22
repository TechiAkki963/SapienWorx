import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Jobs in India | Search Roles by Skill, Location & Experience",
  description: "Search live jobs on SapienWorx by role, skill, location, experience and work mode. Explore opportunities and apply with your candidate profile.",
  alternates: { canonical: "https://sapienworx.com/jobs" },
  openGraph: {
    type: "website",
    title: "Jobs in India | SapienWorx",
    description: "Search live jobs by role, skill, location, experience and work mode on SapienWorx.",
    url: "https://sapienworx.com/jobs",
  },
};

export default function JobsBrowseLayout({ children }: { children: ReactNode }) {
  return children;
}
