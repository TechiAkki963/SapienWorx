"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusMenu } from "@/components/recruiter/status-menu";
import { apiRequest } from "@/lib/api";
import { experience, PipelineRow, stages } from "@/lib/recruiter";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "C";
}

function avatarTone(name: string) {
  const tones = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-800", "bg-cyan-100 text-cyan-800"];
  const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[hash % tones.length];
}

export function PipelineTable({ rows, compact = false }: { rows: PipelineRow[]; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");

  async function change(id: string, stage: string) {
    setBusy(id);
    try {
      await apiRequest(`/api/v1/recruiter/applications/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) });
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
        </div>
        <p className="mt-3 font-bold text-ink">No candidates match these filters.</p>
        <p className="mt-1 text-sm text-ink-muted">Adjust filters or wait for new applications.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(16,33,63,0.03)]">
      <table className={`${compact ? "min-w-[760px]" : "min-w-[1080px]"} w-full border-collapse text-left text-sm`}>
        <thead className="border-b border-line/70 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
          <tr>
            <th className="px-4 py-3">Candidate</th>
            <th className="px-3 py-3">Job</th>
            {!compact && <><th className="px-3 py-3">Experience</th><th className="px-3 py-3">Notice</th><th className="px-3 py-3">Location</th></>}
            <th className="px-3 py-3">Applied</th>
            <th className="px-3 py-3">Stage</th>
            {!compact && <th className="px-3 py-3"><span className="sr-only">Profile</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.application_id} className="group border-t border-line/50 align-middle transition hover:bg-slate-50/65">
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${avatarTone(row.candidate_name)}`}>{initials(row.candidate_name)}</div>
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{row.candidate_name}</p>
                    <p className="mt-0.5 max-w-[16rem] truncate text-xs text-ink-muted">{row.headline ?? "No headline"}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3.5 font-semibold text-ink">{row.job_title}</td>
              {!compact && <><td className="px-3 py-3.5 text-ink-muted">{experience(row.experience_months)}</td><td className="px-3 py-3.5 text-ink-muted">{row.notice_period_days == null ? "—" : `${row.notice_period_days}d`}</td><td className="px-3 py-3.5 text-ink-muted">{row.city ?? "—"}</td></>}
              <td className="px-3 py-3.5 text-xs font-medium text-ink-muted">{new Date(row.applied_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
              <td className="px-3 py-3.5">
                <StatusMenu value={row.stage} options={stages} disabled={busy === row.application_id} ariaLabel={`Stage for ${row.candidate_name}`} onChange={(stage) => change(row.application_id, stage)} />
              </td>
              {!compact && <td className="px-3 py-3.5 text-right"><Link href={`/recruiter/candidates/${row.candidate_id}`} className="inline-flex translate-x-1 items-center gap-1 text-xs font-bold text-indigo opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 focus:translate-x-0 focus:opacity-100">Open profile <span aria-hidden="true">→</span></Link></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
