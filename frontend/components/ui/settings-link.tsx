"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEventHandler } from "react";
import { SettingsIcon } from "./settings-icon";

/** Routes and permission decisions stay with each portal's existing shell. */
export function SettingsLink({ href, label = "Settings", exact = false, onClick }: {
  href: string;
  label?: string;
  exact?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const pathname = usePathname();
  const active = pathname === href || (!exact && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className="swx-settings-link"
      onClick={onClick}
    >
      <SettingsIcon />
    </Link>
  );
}
