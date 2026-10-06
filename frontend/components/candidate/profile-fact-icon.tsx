export function ProfileFactIcon({
  type,
}: {
  type: "location" | "phone" | "experience" | "email" | "salary" | "calendar";
}) {
  const paths = {
    location: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    phone: (
      <path d="m7 3 3 5-2 2c2 3 3 4 6 6l2-2 5 3c0 4-2 5-5 4C9 19 5 15 3 8 2 5 3 3 7 3Z" />
    ),
    experience: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V3h8v4M3 12h18M10 11v3h4v-3" />
      </>
    ),
    email: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    salary: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 9h18M16 13h5v4h-5Z" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M7 3v4M17 3v4M7 14h2m2 0h2m2 0h2M7 17h2m2 0h2" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type]}
    </svg>
  );
}
