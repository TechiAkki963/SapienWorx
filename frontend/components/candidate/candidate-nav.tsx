"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    label: "Overview",
    mobile: "Home",
    href: "/candidate",
    icon: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
    primary: true,
  },
  {
    label: "Find Jobs",
    mobile: "Jobs",
    href: "/candidate/jobs",
    icon: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6",
    primary: true,
  },
  {
    label: "Saved Jobs",
    mobile: "Saved",
    href: "/candidate/saved",
    icon: "M6 3h12v18l-6-4-6 4Z",
    primary: false,
  },
  {
    label: "Applications",
    mobile: "Applications",
    href: "/candidate/applications",
    icon: "M5 4h14v17H5ZM9 4V2h6v2M8 9h8M8 13h8M8 17h5",
    primary: true,
  },
  {
    label: "Interviews",
    mobile: "Interviews",
    href: "/candidate/interviews",
    icon: "M3 5h18v16H3ZM7 2v6M17 2v6M3 10h18M7 14h3M14 14h3",
    primary: false,
  },
  {
    label: "Inbox",
    mobile: "Inbox",
    href: "/candidate/inbox",
    icon: "M3 5h18v14H3ZM3 6l9 7 9-7",
    primary: true,
  },
  {
    label: "My Profile",
    mobile: "Profile",
    href: "/candidate/profile",
    icon: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21v-2a8 8 0 0 1 16 0v2",
    primary: true,
  },
] as const;

export function CandidateNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      className={mobile ? "candidate-mobile-nav" : "candidate-sidebar-nav"}
      aria-label={
        mobile ? "Candidate mobile navigation" : "Candidate workspace"
      }
    >
      {items
        .filter((item) => !mobile || item.primary)
        .map((item) => {
          const active =
            item.href === "/candidate"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={item.icon} />
              </svg>
              <span>{mobile ? item.mobile : item.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
