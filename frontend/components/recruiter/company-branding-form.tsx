"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";

export function CompanyBrandingForm({ companyName, initialLogoURL }: { companyName: string; initialLogoURL?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest("/api/v1/recruiter/company/branding", { method: "PATCH", body: JSON.stringify({ logo_url: data.get("logo_url") }) });
      setMessage("Company logo updated.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not update company branding.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink shadow-sm transition hover:border-indigo/25 hover:text-indigo">Company branding</button>;
  }

  return (
    <div className="rounded-2xl border border-line/70 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-indigo">Employer identity</p><h2 className="mt-1 font-bold text-navy">{companyName}</h2></div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-ink-muted hover:text-ink">Close</button>
      </div>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1.5 text-xs font-bold text-ink">Company logo URL
          <input type="url" name="logo_url" defaultValue={initialLogoURL} placeholder="https://company.com/logo.png" className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15" />
        </label>
        <button type="submit" disabled={busy} className="min-h-10 rounded-xl bg-indigo px-4 text-xs font-bold text-white transition hover:bg-violet-ink disabled:opacity-60">{busy ? "Saving…" : "Save logo"}</button>
      </form>
      <p className="mt-2 text-[11px] leading-5 text-ink-muted">This verified-company logo appears on candidate-facing job cards. Until managed file uploads move to S3, use a stable HTTPS image URL.</p>
      {message && <p className="mt-2 text-xs font-semibold text-ink">{message}</p>}
    </div>
  );
}
