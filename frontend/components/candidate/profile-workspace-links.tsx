"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function ProfileWorkspaceLinks() {
  const pathname = usePathname();
  if (pathname !== "/candidate/profile") return null;
  const links = [
    ["/candidate", "Overview"],
    ["/candidate/jobs", "Jobs"],
    ["/candidate/applications", "Applications"],
    ["/candidate/inbox", "Messages"],
  ];
  return (
    <nav aria-label="Candidate workspace" className="profile-workspace-links">
      {links.map(([href, label]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
