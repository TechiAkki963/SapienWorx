"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest, APIRequestError } from "@/lib/api";
import { JobDescriptionDraft, JDSourcedValue, JDSuggestionKind, renderJDGenerationDraft } from "@/lib/jd-generation";

export type JDGenerationFields = {
  title: string; location: string;
  min_experience_years: number | null; max_experience_years: number | null;
  employment_type: string; work_mode: string; department: string; role_category: string;
  skills: string[]; responsibilities: string; company_overview: string; why_join: string;
  education_requirements: string[];
};
export type JDGenerationState = { id: string; revision: number; reviewed: boolean; existing: boolean };
type GenerationResponse = {
  id: string; revision: number;
  result: { status: string; domain_valid: boolean; value?: {
    generated_description: string; warnings: string[]; regeneration: number; suggested_skills?: string[]; draft?: JobDescriptionDraft; structured_fields?: JDGenerationFields;
  } };
};

export function JDGenerationAssistant({ fields, generation, reviewFields, onUseDraft, onReviewed, onAcceptSkill, onAcceptSuggestion }: {
  fields: JDGenerationFields;
  generation: JDGenerationState;
  reviewFields: Record<string, unknown>;
  onUseDraft: (description: string, generation: JDGenerationState) => void;
  onReviewed: (revision: number, reviewed?: boolean) => void;
  onAcceptSkill: (skill: string) => void;
  onAcceptSuggestion: (kind: JDSuggestionKind, value: string, receipt: JDGenerationState) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"generate" | "review" | "">("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<GenerationResponse | null>(null);
  const [regenerations, setRegenerations] = useState(0);
  const [suggestionTab, setSuggestionTab] = useState<"skills" | "duties" | "review">("skills");
  const [accepted, setAccepted] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const reviewKey = useRef("");
  reviewKey.current = JSON.stringify(reviewFields);
  useEffect(() => () => controller.current?.abort(), []);

  const valid = Boolean(fields.title.trim() && fields.location.trim() && fields.min_experience_years != null && fields.max_experience_years != null && Number.isInteger(fields.min_experience_years) && Number.isInteger(fields.max_experience_years) && fields.min_experience_years >= 0 && fields.max_experience_years >= fields.min_experience_years && fields.max_experience_years <= 60);

  async function generate(regenerate = false) {
    setMessage("");
    if (!valid) { setMessage("Add a title, location and a valid minimum/maximum experience range (0–60 years) in Basics."); return; }
    if (!consent) { setMessage("Allow AI processing of the visible role details, or continue writing manually."); return; }
    const requestController = new AbortController();
    controller.current = requestController;
    setBusy("generate");
    try {
      const result = await apiRequest<GenerationResponse>("/api/v1/intelligence/jobs/generate-description", {
        method: "POST", signal: requestController.signal,
        body: JSON.stringify({ version: "v1.1", fields: { ...fields, title: fields.title.trim(), location: fields.location.trim() }, external_ai_consent: true, ...(regenerate ? { regenerate_from: draft?.id || generation.id } : {}) }),
      });
      if (requestController.signal.aborted) return;
      if (!["requires_review", "owner_reviewed"].includes(result.result.status) || !result.result.domain_valid || !result.result.value?.generated_description) throw new Error("invalid_proposal");
      setDraft({ ...result, result: { ...result.result, value: { ...result.result.value, structured_fields: result.result.value.structured_fields || { ...fields } } } });
      setAccepted([]); setSuggestionTab("skills");
      setRegenerations(result.result.value.regeneration);
      setMessage("Draft ready. Review it below, then choose Use this draft. Your editor has not been overwritten.");
    } catch (error) {
      if (requestController.signal.aborted) return;
      setMessage(error instanceof APIRequestError && error.status === 429
        ? "The AI usage limit has been reached. Continue writing manually and try again later."
        : "AI generation is temporarily unavailable. You can continue writing the description manually.");
    } finally { if (controller.current === requestController) setBusy(""); }
  }

  function changeSuggestion(kind: JDSuggestionKind, id: string, value: string | null) {
    setDraft(current => {
      if (!current?.result.value?.draft) return current;
      const next = { ...current.result.value.draft, [kind]: value === null ? current.result.value.draft[kind].filter(item => item.id !== id) : current.result.value.draft[kind].map(item => item.id === id ? { ...item, value, edited_by_recruiter: true } : item) };
      return { ...current, result: { ...current.result, value: { ...current.result.value, draft: next, generated_description: renderJDGenerationDraft(next, current.result.value.structured_fields || {}) } } };
    });
  }

  function suggestionAccepted(kind: JDSuggestionKind, item: JDSourcedValue) {
    if (kind === "required_skills") return fields.skills.includes(item.value);
    if (kind === "responsibilities") return fields.responsibilities.includes(item.value);
    if (kind === "qualifications") return fields.education_requirements.includes(item.value);
    return accepted.includes(item.id) && String(reviewFields.description || "").includes(item.value);
  }

  async function review() {
    setMessage("");
    if (generation.existing) { onReviewed(generation.revision); setMessage("Review confirmed. Your approval will be recorded when you save."); return; }
    const key = reviewKey.current;
    setBusy("review");
    try {
      const result = await apiRequest<GenerationResponse>(`/api/v1/intelligence/jobs/generations/${generation.id}/review`, {
        method: "POST", body: JSON.stringify({ expected_revision: generation.revision, fields: reviewFields, confirm: true }),
      });
      if (key !== reviewKey.current) { onReviewed(result.revision, false); setMessage("The role changed during review. Review the latest description and requirements again."); return; }
      onReviewed(result.revision);
      setMessage("Review recorded. You can preview the draft and publish when the remaining job requirements are complete.");
    } catch {
      setMessage("Review could not be recorded. Your writing is preserved. Try reviewing again before publishing.");
    } finally { setBusy(""); }
  }

  return <section aria-label="AI description assistant" className="min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-bold text-navy">A starting point for your description</h3><p className="mt-1 text-xs leading-5 text-ink-muted">Start with a title, location and experience range. Writing manually is always available.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => generate()}>{busy === "generate" ? "Generating job description…" : "Generate with AI"}</Button>
        {busy === "generate" && <Button type="button" variant="ghost" onClick={() => { controller.current?.abort(); setBusy(""); setMessage("Generation cancelled. Continue writing manually. A request already sent may still count toward usage."); }}>Cancel generation</Button>}
      </div>
    </div>
    <label className="mt-3 flex min-h-11 items-center gap-2 text-xs leading-5 text-ink"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="h-4 w-4 shrink-0 accent-blue-600" />Allow these role details to be sent to the AI provider.</label>
    <p className="text-xs leading-5 text-ink-muted">Private compensation and internal notes are excluded. AI never publishes or changes matching requirements automatically.</p>
    <p role="status" aria-live="polite" className="mt-2 text-sm leading-6 text-ink">{message}</p>
    {draft?.result.value && <div className="mt-4 grid min-w-0 gap-3 rounded-xl border border-line bg-slate-50 p-2.5 sm:p-4">
      <div className="flex flex-wrap justify-between gap-2"><h4 className="text-sm font-bold text-navy">Generated draft · not yet applied</h4><span className="text-xs font-semibold text-ink-muted">Review required</span></div>
      <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-6 text-ink">{draft.result.value.generated_description}</pre>
      {draft.result.value.warnings?.length > 0 && <ul className="list-disc pl-5 text-xs leading-5 text-ink-muted">{draft.result.value.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
      {draft.result.value.draft ? <div className="min-w-0 rounded-lg border-line bg-white px-0 py-2 sm:border sm:p-4" aria-label="Suggested role requirements">
        <h4 className="text-sm font-bold text-navy">Role guidance · review before accepting</h4>
        <p className="mt-1 text-xs leading-5 text-ink-muted">SapienWorx occupation guidance is not employer policy. Only explicitly accepted core skills affect matching. Optional skills stay in the description.</p>
        <div role="group" aria-label="Suggestion sections" className="my-3 flex flex-wrap gap-1">{([ ["skills", "Skills"], ["duties", "Responsibilities"], ["review", "Review notes"] ] as const).map(([tab,label]) => <Button key={tab} type="button" className="px-2.5 sm:px-4" variant={suggestionTab === tab ? "secondary" : "ghost"} aria-label={label} aria-pressed={suggestionTab === tab} onClick={() => setSuggestionTab(tab)}>{tab === "duties" ? <><span className="sm:hidden">Duties</span><span className="hidden sm:inline">{label}</span></> : tab === "review" ? <><span className="sm:hidden">Review</span><span className="hidden sm:inline">{label}</span></> : label}</Button>)}</div>
        <div className="grid max-h-80 min-w-0 gap-2 overflow-y-auto overscroll-contain pr-1" aria-label="Role suggestions">
          {(suggestionTab === "skills" ? (["required_skills", "preferred_skills", "qualifications"] as const) : suggestionTab === "duties" ? (["responsibilities"] as const) : []).flatMap(kind => draft.result.value!.draft![kind].filter(item => item.source !== "recruiter_supplied").map(item => <SuggestionRow key={item.id} item={item} kind={kind} accepted={suggestionAccepted(kind, item)}
            onEdit={value => changeSuggestion(kind, item.id, value)} onRemove={() => changeSuggestion(kind, item.id, null)}
            onAccept={() => { onAcceptSuggestion(kind, item.value, { id: draft.id, revision: draft.revision, reviewed: false, existing: false }); setAccepted(current => [...current, item.id]); }} />))}
          {suggestionTab === "review" && draft.result.value.draft.assumptions_requiring_review.map(item => <div key={item.id} className="rounded-lg border border-line p-3 text-sm leading-6 text-ink"><p className="mb-1 text-xs font-semibold text-ink-muted">{item.source === "ai_suggested" ? "AI suggested · confirm with hiring team" : "SapienWorx · role guidance"}</p>{item.value}</div>)}
        </div>
      </div> : Boolean(draft.result.value.suggested_skills?.length) && <div><h4 className="text-sm font-bold text-navy">Suggested skills · not requirements</h4><p className="mt-1 text-xs leading-5 text-ink-muted">From the approved occupation taxonomy. Accept explicitly, then edit in Skills &amp; competencies. They are not included in this draft.</p><div className="mt-2 grid gap-2">{draft.result.value.suggested_skills!.filter(skill => !fields.skills.includes(skill)).map(skill => <div key={skill} className="flex flex-wrap items-center gap-2 text-sm"><span className="min-w-0 break-words">{skill}</span><Button type="button" variant="secondary" onClick={() => onAcceptSkill(skill)}>Accept {skill}</Button><Button type="button" variant="ghost" onClick={() => setDraft(current => current?.result.value ? { ...current, result: { ...current.result, value: { ...current.result.value, suggested_skills: current.result.value.suggested_skills?.filter(item => item !== skill) } } } : current)}>Remove {skill}</Button></div>)}</div></div>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={Boolean(busy)} onClick={() => { onUseDraft(draft.result.value!.generated_description, { id: draft.id, revision: draft.revision, reviewed: false, existing: false }); setDraft(null); setMessage("Draft added to the editor. Edit it and review the role requirements before confirming."); }}>Use this draft</Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy) || regenerations >= 3} onClick={() => generate(true)}>Regenerate</Button>
        <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Discard draft</Button>
      </div>
      <p className="text-xs text-ink-muted">At most three regenerations per draft chain. Usage and budget limits also apply.</p>
    </div>}
    {generation.id && <div className="mt-4 rounded-xl border border-line px-4 py-3">
      <p className="text-sm font-semibold text-ink">{generation.reviewed ? "AI draft reviewed" : "AI draft · review required"}</p>
      <p className="mt-1 text-xs leading-5 text-ink-muted">Read the description and explicit skills/qualifications. Text edits do not automatically change matching criteria.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!generation.reviewed && <Button type="button" disabled={Boolean(busy)} onClick={review}>{busy === "review" ? "Recording review…" : "I reviewed the description and requirements"}</Button>}
        <Button type="button" variant="secondary" disabled={Boolean(busy) || regenerations >= 3} onClick={() => generate(true)}>Regenerate description</Button>
      </div>
    </div>}
  </section>;
}

function SuggestionRow({ item, kind, accepted, onEdit, onRemove, onAccept }: { item: JDSourcedValue; kind: JDSuggestionKind; accepted: boolean; onEdit: (value: string) => void; onRemove: () => void; onAccept: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.value);
  const label = kind === "required_skills" ? "Core recommendation" : kind === "preferred_skills" ? "Optional recommendation" : kind === "responsibilities" ? "Role responsibility" : "Qualification suggestion";
  return <div className="min-w-0 rounded-lg border border-line px-2 py-3 sm:p-3">
    <p className="text-xs font-semibold leading-5 text-ink-muted">{label} · {item.edited_by_recruiter ? "Edited by you · originally " : ""}{item.source === "ai_suggested" ? "AI suggested" : "SapienWorx"}{accepted ? " · accepted by you" : ""}</p>
    {editing ? <div className="mt-2"><label className="block text-sm font-semibold text-ink">Edit suggestion<textarea aria-label={`Edit ${item.value}`} maxLength={kind === "responsibilities" ? 800 : 200} rows={2} className="mt-1 block min-h-11 w-full resize-y rounded-lg border border-line bg-white p-2 text-sm font-normal text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" value={value} onChange={event => setValue(event.target.value)} /></label><div className="mt-2 flex flex-wrap gap-1"><Button type="button" variant="secondary" disabled={!value.trim()} onClick={() => { onEdit(value.trim()); setEditing(false); }}>Save suggestion</Button><Button type="button" variant="ghost" onClick={() => { setValue(item.value); setEditing(false); }}>Cancel edit</Button></div></div> : <p className="mt-1 break-words text-sm leading-6 text-ink">{item.value}</p>}
    {!editing && <div className="mt-2 flex flex-wrap gap-1"><Button type="button" variant="secondary" aria-label={accepted ? `${item.value} accepted` : kind === "preferred_skills" ? `Keep ${item.value} as optional` : `Accept ${item.value}`} disabled={accepted} onClick={onAccept}>{accepted ? "Accepted" : kind === "preferred_skills" ? "Keep optional" : "Accept"}</Button>{!accepted && <><Button type="button" variant="ghost" aria-label={`Edit ${item.value}`} onClick={() => setEditing(true)}>Edit</Button><Button type="button" variant="ghost" aria-label={`Remove ${item.value}`} onClick={onRemove}>Remove</Button></>}</div>}
    {accepted && <p className="mt-1 text-xs leading-5 text-ink-muted">{kind === "required_skills" ? "Edit or remove the accepted requirement in Skills & competencies." : kind === "responsibilities" ? "Edit or remove the accepted text in Responsibilities." : "You can edit or remove this in the description. It does not become a matching requirement."}</p>}
  </div>;
}
