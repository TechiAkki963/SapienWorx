"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAdminPermission } from "@/components/admin/admin-access-provider";

export function EvaluateAlertsButton() {
  const allowed = useAdminPermission("control_plane.manage");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  if (!allowed) return null;
  async function run() {
    setPending(true);
    setMessage("");
    try {
      const result = await apiRequest<{triggered:number}>("/api/v1/admin/alerts/evaluate", { method: "POST" });
      setMessage(String(result.triggered) + " rule(s) triggered.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Evaluation failed.");
    } finally {
      setPending(false);
    }
  }
  return <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => void run()} disabled={pending} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{pending ? "Evaluating…" : "Evaluate alert rules now"}</button>{message&&<p className="text-xs text-slate-500">{message}</p>}</div>;
}

export function AlertActions({ id, status, owner }: { id:string; status:string; owner:string }) {
  const allowed = useAdminPermission("control_plane.manage");
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  if (!allowed || status === "resolved") return null;
  async function run(next: "acknowledged"|"resolved") {
    const newOwner = window.prompt("Alert owner", owner || "") ?? owner;
    setPending(next);
    setMessage("");
    try {
      await apiRequest("/api/v1/admin/alerts/" + id, { method:"PATCH", body:JSON.stringify({status:next,owner:newOwner.trim()}) });
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Alert update failed.");
    } finally {
      setPending("");
    }
  }
  return <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!!pending} onClick={() => void run("acknowledged")} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Acknowledge</button><button type="button" disabled={!!pending} onClick={() => void run("resolved")} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Resolve</button>{message&&<span className="text-xs text-red-600">{message}</span>}</div>;
}
