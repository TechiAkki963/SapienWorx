"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type Template = { id: string; title: string; subject_template: string; body_template: string };
type Step = { delay_days: number; subject_template: string; body_template: string };
type Sequence = { id: string; name: string; status: string; steps: Step[] };
const blankStep = (delay = 0): Step => ({ delay_days: delay, subject_template: "", body_template: "" });

export function OutreachWorkspace() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<Step[]>([blankStep(0)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const [templateResult, sequenceResult] = await Promise.all([
      apiRequest<{ items: Template[] }>("/api/v1/recruiter/message-templates"),
      apiRequest<{ items: Sequence[] }>("/api/v1/recruiter/outreach/sequences"),
    ]);
    setTemplates(templateResult.items ?? []);
    setSequences(sequenceResult.items ?? []);
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load outreach workspace."));
  }, []);

  const canSave = useMemo(() =>
    Boolean(name.trim()) && steps.length > 0 && steps.every((step, index) =>
      Boolean(step.subject_template.trim()) && Boolean(step.body_template.trim()) && (index === 0 ? step.delay_days === 0 : step.delay_days >= 14)
    ), [name, steps]);

  function applyTemplate(index: number, templateID: string) {
    const template = templates.find((item) => item.id === templateID);
    if (!template) return;
    setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, subject_template: template.subject_template, body_template: template.body_template } : step));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest("/api/v1/recruiter/outreach/sequences", { method: "POST", body: JSON.stringify({ name: name.trim(), steps }) });
      setName(""); setSteps([blankStep(0)]); setNotice("Sequence saved successfully.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save sequence.");
    } finally { setBusy(false); }
  }

  async function archive(sequenceID: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await apiRequest("/api/v1/recruiter/outreach/sequences/" + sequenceID, { method: "DELETE" });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not archive sequence.");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)]">
      <form onSubmit={save} className="rounded-2xl border border-line/70 bg-white p-5 shadow-[0_1px_3px_rgba(16,33,63,.04)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-indigo">Sequence builder</p>
            <h2 className="mt-1 text-xl font-bold tracking-[-.02em] text-navy">Reusable outreach sequence</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">Create a consistent multi-step outreach plan without weakening the existing bulk InMail controls.</p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700">14-day anti-spam guard</span>
        </div>

        <label className="mt-5 grid gap-1.5 text-xs font-bold text-ink">
          Sequence name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} className="h-11 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-indigo/40 focus:ring-4 focus:ring-indigo-soft/60" placeholder="Senior engineering nurture" />
        </label>

        <div className="mt-5 grid gap-4">
          {steps.map((step, index) => (
            <section key={index} className="rounded-2xl border border-line/70 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-extrabold text-navy">Step {index + 1}</p><p className="mt-0.5 text-xs text-ink-muted">{index === 0 ? "Immediate launch message" : "Cooldown-safe follow-up"}</p></div>
                {index > 0 && <button type="button" onClick={() => setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))} className="text-xs font-bold text-rose-600 hover:text-rose-700">Remove</button>}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-bold text-ink">Saved template<select defaultValue="" onChange={(event) => applyTemplate(index, event.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm"><option value="">Choose template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select></label>
                <label className="grid gap-1 text-xs font-bold text-ink">Delay (days)<input type="number" min={index === 0 ? 0 : 14} value={step.delay_days} disabled={index === 0} onChange={(event) => setSteps((current) => current.map((item, stepIndex) => stepIndex === index ? { ...item, delay_days: Number(event.target.value) } : item))} className="h-10 rounded-xl border border-line bg-white px-3 text-sm disabled:bg-slate-100" /></label>
              </div>
              <label className="mt-3 grid gap-1 text-xs font-bold text-ink">Subject<input value={step.subject_template} maxLength={255} onChange={(event) => setSteps((current) => current.map((item, stepIndex) => stepIndex === index ? { ...item, subject_template: event.target.value } : item))} className="h-10 rounded-xl border border-line bg-white px-3 text-sm" placeholder="Hi {{CandidateName}}" /></label>
              <label className="mt-3 grid gap-1 text-xs font-bold text-ink">Message<textarea value={step.body_template} maxLength={5000} rows={5} onChange={(event) => setSteps((current) => current.map((item, stepIndex) => stepIndex === index ? { ...item, body_template: event.target.value } : item))} className="rounded-xl border border-line bg-white px-3 py-2 text-sm leading-6" placeholder="I wanted to discuss {{JobTitle}} with you." /></label>
              <p className="mt-2 text-[11px] text-ink-muted">Variables: <strong>{{"{{CandidateName}}"}}</strong> · <strong>{{"{{JobTitle}}"}}</strong></p>
            </section>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={steps.length >= 10} onClick={() => setSteps((current) => [...current, blankStep(14)])} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-navy hover:bg-slate-50 disabled:opacity-40">+ Add follow-up</button>
          <button type="submit" disabled={!canSave || busy} className="rounded-xl bg-navy px-5 py-2.5 text-sm font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Saving…" : "Save sequence"}</button>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{notice}</p>}
      </form>

      <aside className="rounded-2xl border border-line/70 bg-white p-5 shadow-[0_1px_3px_rgba(16,33,63,.04)] sm:p-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-indigo">Saved sequences</p>
        <h2 className="mt-1 text-xl font-bold tracking-[-.02em] text-navy">Outreach library</h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">Use Talent Pools for candidate selection and Bulk InMail launch. Sequence execution reuses those server-side protections.</p>
        <Link href="/recruiter/talent-pool" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-indigo px-4 text-sm font-extrabold text-white hover:bg-indigo/90">Open Talent Pools</Link>
        <div className="mt-5 grid gap-3">
          {sequences.length === 0 ? <div className="rounded-xl border border-dashed border-line p-4 text-sm leading-6 text-ink-muted">No saved sequences yet. Build the first sequence here.</div> : sequences.map((sequence) => (
            <article key={sequence.id} className="rounded-xl border border-line/70 p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-navy">{sequence.name}</p><p className="mt-1 text-xs text-ink-muted">{sequence.steps.length} step{sequence.steps.length === 1 ? "" : "s"} · {sequence.status}</p></div><button type="button" disabled={busy} onClick={() => archive(sequence.id)} className="text-xs font-bold text-ink-muted hover:text-rose-600 disabled:opacity-40">Archive</button></div>
              <div className="mt-3 flex flex-wrap gap-2">{sequence.steps.map((step, index) => <span key={index} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-ink-muted">Step {index + 1}{index === 0 ? " · now" : " · +" + step.delay_days + "d"}</span>)}</div>
            </article>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-soft/40 p-4 text-xs leading-5 text-ink-muted"><strong className="text-navy">Safety invariant:</strong> no sequence follow-up can be configured below 14 days, matching the existing recruiter-to-candidate bulk outreach cooldown.</div>
      </aside>
    </div>
  );
}