"use client";

import { useEffect, useRef, useState } from "react";
import { useAICapabilities } from "@/hooks/use-ai-capabilities";
import { apiRequest } from "@/lib/api";
import { aiErrorMessage, jobParseFields, JobParseFields, JobParseKey, JobParseResponse, parseDisplay } from "@/lib/ai-parsing";
import { Button } from "@/components/ui/button";

const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600";

export function JDParseAssistant({ currentFields, onApply }: { currentFields: JobParseFields; onApply: (fields: JobParseFields) => void }) {
  const capability = useAICapabilities("job.parse");
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [proposal, setProposal] = useState<JobParseResponse | null>(null);
  const [draft, setDraft] = useState<Partial<Record<JobParseKey, string>>>({});
  const [selected, setSelected] = useState<JobParseKey[]>([]);
  const [removed, setRemoved] = useState<JobParseKey[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"parse" | "review" | "">("");
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const review = useRef<HTMLDivElement>(null);
  const currentKey = useRef("");
  currentKey.current = JSON.stringify(currentFields);
  useEffect(() => () => controller.current?.abort(), []);

  async function parse() {
    setMessage("");
    if (!capability.available) return;
    if (!consent || text.trim().length < 30 || text.length > 32000) {
      setMessage("Paste 30–32,000 characters and allow processing, or continue entering the role manually."); return;
    }
    const request = new AbortController(); controller.current = request; setBusy("parse");
    try {
      const result = await apiRequest<JobParseResponse>("/api/v1/intelligence/jobs/parse", { method: "POST", signal: request.signal, body: JSON.stringify({ text: text.trim(), external_ai_consent: true }) });
      if (request.signal.aborted) return;
      if (!["requires_review", "owner_reviewed"].includes(result.result.status) || !result.result.domain_valid || !result.result.value) throw new Error("invalid_proposal");
      setProposal(result);
      setDraft(Object.fromEntries(jobParseFields.map(([key]) => [key, parseDisplay(result.result.value[key])])));
      setSelected([]); setRemoved([]); setConfirmed(false);
      setMessage("Review the proposal. No job fields have changed. Choose only the fields you want to import.");
      requestAnimationFrame(() => review.current?.focus());
    } catch (error) {
      if (!request.signal.aborted) setMessage(aiErrorMessage(error, "AI parsing is unavailable. Your pasted description is preserved; continue entering the job manually."));
    } finally { if (controller.current === request) setBusy(""); }
  }

  async function apply() {
    if (!proposal || !confirmed || !selected.length) { setMessage("Choose fields and confirm your review before importing."); return; }
    const changes: JobParseFields = {};
    for (const [key, , kind] of jobParseFields) {
      if (!selected.includes(key)) continue;
      const value = (draft[key] || "").trim();
      if (!value) { setMessage(`Enter a value for ${key.replaceAll("_", " ")}, or remove it from the import.`); return; }
      if (kind === "number") {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0 || !key.includes("salary") && !Number.isInteger(number)) { setMessage("Use valid non-negative numbers; years and openings must be whole numbers."); return; }
        changes[key] = number;
      } else changes[key] = kind === "list" ? value.split("\n").map(v => v.trim()).filter(Boolean) : value;
    }
    const fields = Object.fromEntries(jobParseFields.map(([key]) => [key, currentFields[key] ?? null]));
    Object.assign(fields, changes);
    if (!fields.title || !fields.employment_type || !fields.work_mode || Number(fields.openings) < 1) {
      setMessage("Include a job title, employment type, workplace model and positive openings count, or add those in Basics before importing."); return;
    }
    const before = currentKey.current;
    const request = new AbortController(); controller.current = request;
    setBusy("review"); setMessage("");
    try {
      const result = await apiRequest<JobParseResponse>(`/api/v1/intelligence/parses/${proposal.id}`, { method: "PATCH", signal: request.signal, body: JSON.stringify({ expected_revision: proposal.revision, fields, confirm: true }) });
      if (request.signal.aborted) return;
      setProposal(result);
      if (before !== currentKey.current) { setConfirmed(false); setMessage("The role changed during review. Review the latest role again before importing."); return; }
      if (result.result.status !== "owner_reviewed") throw new Error("review_not_recorded");
      onApply(changes); setProposal(null); setConfirmed(false);
      setMessage("Reviewed fields added to your unsaved job. All other fields are preserved. Save the draft when you are ready.");
    } catch (error) {
      if (!request.signal.aborted) setMessage(aiErrorMessage(error, "Your review could not be saved. No job fields have changed. Try again or continue manually."));
    } finally { if (controller.current === request) setBusy(""); }
  }

  return <details className="mb-4 min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5">
    <summary className="min-h-11 cursor-pointer text-sm font-bold text-navy">Import an existing job description</summary>
    <section aria-label="Import job description with AI" className="mt-3 grid min-w-0 gap-3">
      <p className="text-sm leading-6 text-ink-muted">Paste a description, then review each proposed change. Importing never publishes a job or changes requirements automatically.</p>
      <label className="grid gap-2 text-sm font-semibold text-ink">Existing job description<textarea rows={5} maxLength={32000} disabled={Boolean(busy)} value={text} onChange={event => setText(event.target.value)} className={inputClass} /></label>
      <p className="text-xs text-ink-muted">Remove unnecessary contact details or confidential information. Only this text is sent to the AI provider.</p>
      <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" disabled={Boolean(busy)} checked={consent} onChange={event => setConsent(event.target.checked)} className="h-4 w-4 accent-blue-600" />Allow this job description to be sent to the AI provider.</label>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={Boolean(busy) || !capability.available} onClick={parse}>{busy === "parse" ? "Parsing description…" : "Parse with AI"}</Button>
        {busy === "parse" && <Button type="button" variant="secondary" onClick={() => { controller.current?.abort(); controller.current = null; setBusy(""); setMessage("Parsing cancelled. Your writing is preserved. A request already sent may still count toward usage."); }}>Cancel parsing</Button>}</div>
      {!capability.available && <p className="text-sm leading-6 text-ink">{capability.loading ? "Checking AI availability…" : "AI parsing is not enabled for your account. Manual entry remains available."}</p>}
      {busy === "parse" && <p role="status" className="text-sm text-ink-muted">This can take up to a minute. You can cancel and keep writing manually.</p>}
      {message && <p role="status" aria-live="polite" className="break-words text-sm leading-6 text-ink">{message}</p>}
      {proposal && <div ref={review} tabIndex={-1} aria-label="Review imported job fields" className="grid min-w-0 gap-3 rounded-xl border border-line bg-slate-50 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:p-4">
        <h3 className="font-bold text-navy">Review imported fields</h3><p className="text-sm text-ink-muted">Nothing is selected automatically. Selected requirements affect matching only after you import and save the job.</p>
        {jobParseFields.filter(([key]) => proposal.result.value[key] != null && !removed.includes(key)).map(([key, label, kind]) => <div key={key} className="min-w-0 rounded-lg border border-line bg-white p-3">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" disabled={Boolean(busy)} checked={selected.includes(key)} onChange={event => { setSelected(current => event.target.checked ? [...current, key] : current.filter(k => k !== key)); setConfirmed(false); }} className="h-4 w-4 accent-blue-600" />Use {label.toLowerCase()}</label>
          <label className="grid gap-1 text-xs font-semibold text-ink-muted">Proposed {label.toLowerCase()}
            {kind === "employment" || kind === "work" ? <select disabled={Boolean(busy)} value={draft[key] || ""} onChange={event => { setDraft(current => ({ ...current, [key]: event.target.value })); setConfirmed(false); }} className={inputClass}>
              {(kind === "employment" ? ["full_time", "part_time", "contract", "internship", "temporary"] : ["onsite", "hybrid", "remote"]).map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select> : <textarea disabled={Boolean(busy)} aria-label={`Proposed ${label.toLowerCase()}`} rows={kind === "long" || kind === "list" ? 3 : 1} maxLength={8000} value={draft[key] || ""} onChange={event => { setDraft(current => ({ ...current, [key]: event.target.value })); setConfirmed(false); }} className={inputClass} />}
          </label>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-ink-muted">Current: {parseDisplay(currentFields[key]) || "Not added"}</p>
          <p className="mt-1 text-xs text-ink-muted">From your pasted description · {proposal.result.field_metadata?.[`/${key}`]?.confidence == null ? "Confidence not measured" : `${Math.round(proposal.result.field_metadata[`/${key}`].confidence! * 100)}% extraction confidence`}</p>
          <Button type="button" variant="ghost" aria-label={`Remove proposed ${label.toLowerCase()}`} disabled={Boolean(busy)} onClick={() => { setRemoved(current => [...current, key]); setSelected(current => current.filter(k => k !== key)); setConfirmed(false); }}>Remove</Button>
        </div>)}
        <label className="flex min-h-11 items-start gap-2 py-2 text-sm leading-6 text-ink"><input type="checkbox" disabled={Boolean(busy)} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-blue-600" />I reviewed the selected changes and want them added to this job.</label>
        <div className="flex flex-wrap gap-2"><Button type="button" disabled={Boolean(busy) || !confirmed || !selected.length} onClick={apply}>{busy === "review" ? "Recording review…" : "Use reviewed fields"}</Button><Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => { setProposal(null); setMessage("Proposal discarded. Your existing job fields are unchanged."); }}>Discard proposal</Button></div>
      </div>}
    </section>
  </details>;
}
