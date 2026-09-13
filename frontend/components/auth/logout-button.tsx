"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();
  return <Button variant="secondary" onClick={async () => { try { await apiRequest("/api/v1/auth/logout", { method: "POST" }); } finally { router.replace("/"); router.refresh(); } }}>Sign out</Button>;
}
