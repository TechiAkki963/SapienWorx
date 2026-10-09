"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
export function InvitationAccept({ token }: {
    token: string;
}) { const router = useRouter(); const [error, setError] = useState(""), [busy, setBusy] = useState(false); return <div>{error && <p role="alert" className="mb-4 text-sm swx-company-error">{error}</p>}<button disabled={busy} className="min-h-11 rounded-xl bg-indigo px-5 text-sm font-semibold text-white" onClick={() => { setBusy(true); void apiRequest("/api/v1/company/invitation/accept", { method: "POST", body: JSON.stringify({ token }) }).then(() => { router.push("/company"); router.refresh(); }).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>{busy ? "Accepting…" : "Accept company invitation"}</button></div>; }
