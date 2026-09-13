"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiRequest } from "@/lib/api";

export function MarkReadButton({ id, read }: { id: string; read: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  if (read) return <span className="text-xs font-semibold text-ink-muted">Read</span>;
  return <button type="button" className="text-xs font-bold text-indigo hover:underline disabled:opacity-50" disabled={pending} onClick={async () => { setPending(true); try { await apiRequest(`/api/v1/candidate/notifications/${id}/read`, { method: "PATCH" }); router.refresh(); } finally { setPending(false); } }}>{pending ? "Updating…" : "Mark read"}</button>;
}
