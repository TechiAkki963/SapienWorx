"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
export type ModerationReview = {
    id: string;
    display_name: string;
    kind: string;
    title: string;
    pros: string;
    cons: string;
    advice: string;
    relationship: string;
    job_function: string;
    location: string;
    moderation_flags: string[];
    verified: boolean;
    revision: number;
    moderation_status: string;
    pending_reports: number;
    reports?: {
        kind: string;
        reason: string;
        created_at: string;
    }[];
};
export function CompanyReviewModeration({ items, canManage }: {
    items: ModerationReview[];
    canManage: boolean;
}) { const router = useRouter(); const [busy, setBusy] = useState(""), [error, setError] = useState(""); return <div className="space-y-4">{error && <p role="alert" className="text-sm swx-company-error">{error}</p>}{items.map(r => <article key={r.id} className="rounded-xl border border-slate-200 bg-white p-5"><header><p className="text-sm text-slate-500">{r.display_name} · {r.kind} · Revision {r.revision} · {r.moderation_status}</p><h2 className="mt-2 text-xl font-semibold">{r.title}</h2><p className="mt-2 text-sm">{r.relationship} · {r.job_function} · {r.location}</p></header><dl className="mt-4 space-y-3 text-sm leading-6"><div><dt className="font-semibold">Pros / process</dt><dd className="whitespace-pre-wrap">{r.pros}</dd></div><div><dt className="font-semibold">Cons / improvements</dt><dd className="whitespace-pre-wrap">{r.cons}</dd></div><div><dt className="font-semibold">Moderation signals</dt><dd>{r.moderation_flags?.join(", ") || "No automatic text flags"} · {r.pending_reports} pending reports / appeals</dd></div></dl>{r.reports?.map((report, i) => <div key={i} className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-semibold">{report.kind === "appeal" ? "Reviewer appeal" : "Reported concern"}</p><p className="mt-2 whitespace-pre-wrap">{report.reason}</p></div>)}{canManage && <form className="mt-5 grid gap-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(r.id); setError(""); void apiRequest(`/api/v1/admin/company-reviews/${r.id}`, { method: "PATCH", body: JSON.stringify({ action: f.get("action"), reason: f.get("reason"), verified: f.get("verified") === "on", revision: r.revision }) }).then(() => router.refresh()).catch(e => setError(e.message)).finally(() => setBusy("")); }}><label className="flex min-h-11 items-center gap-3 text-sm"><input name="verified" type="checkbox" defaultChecked={r.verified}/>Private relationship evidence reviewed and verified</label><p className="text-sm leading-6 text-slate-500">Verify employment through authorized private evidence before checking this box. Self-asserted employment history does not establish a verified relationship. Review personal data, threats, spam and naming individuals manually even when no automatic flag appears.</p><label className="grid gap-2 text-sm">Decision<select name="action" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3"><option value="publish">Publish / uphold published review</option><option value="reject">Reject / remove from public view</option></select></label><label className="grid gap-2 text-sm">Decision reason<textarea name="reason" minLength={10} maxLength={2000} required className="min-h-24 rounded-lg border border-slate-200 p-3"/></label><button disabled={!!busy} className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white">{busy === r.id ? "Saving…" : "Apply audited moderation decision"}</button></form>}</article>)}{!items.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No reviews, reports or appeals await moderation.</p>}</div>; }
