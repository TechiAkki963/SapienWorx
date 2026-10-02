"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      className="px-3 text-xs sm:px-5 sm:text-sm"
      variant="secondary"
      onClick={async () => {
        try {
          await apiRequest("/api/v1/auth/logout", { method: "POST" });
        } finally {
          router.replace("/");
          router.refresh();
        }
      }}
      aria-label="Sign out"
    >
      <span className="sm:hidden">Exit</span>
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
