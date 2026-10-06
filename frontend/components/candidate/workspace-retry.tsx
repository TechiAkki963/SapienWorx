"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function WorkspaceRetry({
  href,
  children = "Try again",
  className,
}: {
  href: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return href.split("?")[0] === pathname ? (
    <Button
      type="button"
      variant="secondary"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Retrying…" : children}
    </Button>
  ) : (
    <Button href={href} variant="secondary" className={className}>
      {children}
    </Button>
  );
}
