"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAICapabilities } from "@/hooks/use-ai-capabilities";
import { apiRequest } from "@/lib/api";
import { aiErrorMessage, type ParseMetadata } from "@/lib/ai-parsing";
import { Button } from "@/components/ui/button";

type Value = string | number | boolean;
type Review = {
  result_id: string; revision: number; proposed_profile: Record<string, unknown>;
  parser_generated_summary: string | null;
  fields: Record<string, { metadata: ParseMetadata; review?: { status: string; corrected_value: Value } | null }>;
};
type Preview = { applied_paths: string[]; manual_paths: string[]; saved: boolean; already_applied: boolean };
const control = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600";
function label(path: string) {
  const names: Record<string,string> = {"/identity/display_name":"Full name","/professional/headline":"Professional title","/professional/summary":"Professional summary","/professional/total_experience_months":"Total experience in months","/contact/primary_email":"Email address","/contact/primary_phone":"Mobile number","/contact/alternate_email":"Alternate email","/contact/alternate_phone":"Alternate phone","/location/current/city":"Current city","/location/current/state":"Current state","/location/current/country_code":"Current country","/availability/notice_period_days":"Notice period in days"};
  if(names[path]) return names[path];
  return path.split("/").filter(part=>part && part!=="entity").map(part => /^\d+$/.test(part) ? `#${Number(part) + 1}` : part === "raw_value" ? "as written in CV" : part === "precision" ? "date precision" : part.replaceAll("_", " ")).join(" · ");
}
function leaves(value: unknown, path = "", result: Record<string, Value> = {}) {
  if (value == null) return result;
  if (Array.isArray(value)) value.forEach((item, index) => leaves(item, `${path}/${index}`, result));
  else if (typeof value === "object") Object.entries(value).forEach(([key, item]) => leaves(item, `${path}/${key}`, result));
  else if (["string", "number", "boolean"].includes(typeof value)) result[path] = value as Value;
  return result;
}

export function CVAIParseAssistant({ profileUpdatedAt, editing }: { profileUpdatedAt: string; editing: boolean }) {
  const capability = useAICapabilities("cv.parse"), router = useRouter();
  const [file, setFile] = useState<File | null>(null), [consent, setConsent] = useState(false);
  const [review, setReview] = useState<Review | null>(null), [draft, setDraft] = useState<Record<string, Value>>({});
  const [selected, setSelected] = useState<string[]>([]), [reviewed, setReviewed] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState<"" | "parse" | "review" | "save">("");
  const [message, setMessage] = useState("");
  const abort = useRef<AbortController | null>(null), heading = useRef<HTMLHeadingElement>(null), stamp = useRef("");
  useEffect(() => () => abort.current?.abort(), []);
  const original = review ? leaves(review.proposed_profile) : {};
  if (review?.parser_generated_summary != null) original["/parser_generated_summary"] = review.parser_generated_summary;
  const paths = Object.keys(original).sort();
  function invalidate() { setPreview(null); setReviewed(false); }

  async function parse() {
    if (!capability.available || editing || !profileUpdatedAt) return;
    if (!file || !consent || !/\.(pdf|docx)$/i.test(file.name) || !file.size || file.size > 1500 * 1024) { setMessage("Choose a PDF or DOCX up to 1.5 MB and allow processing, or continue editing manually."); return; }
    const request = new AbortController(); abort.current = request; setBusy("parse"); setMessage(""); setReview(null); setPreview(null); stamp.current = profileUpdatedAt;
    try {
      const body = new FormData(); body.set("file", file); body.set("external_ai_consent", "true");
      const result = await apiRequest<Review>("/api/v1/intelligence/cv/parse", { method: "POST", body, signal: request.signal });
      if (request.signal.aborted) return;
      setReview(result); setDraft(leaves(result.proposed_profile)); setSelected([]); setReviewed(false);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (error) { if (!request.signal.aborted) setMessage(aiErrorMessage(error, "A safe CV proposal could not be prepared. Your profile and saved resume are unchanged. Continue manually or try later.")); }
    finally { if (abort.current === request) setBusy(""); }
  }
  async function prepare() {
    if (!review || !reviewed || !selected.length || editing) return;
    if(selected.some(path=>typeof original[path]==="number" && (typeof draft[path]!=="number" || !Number.isFinite(draft[path])))){setMessage("Enter a valid number for each selected numeric fact, or unselect it to keep your existing data.");return;}
    if (stamp.current !== profileUpdatedAt) { setMessage("Your profile changed. Refresh and review the latest profile before saving."); return; }
    const request = new AbortController(); abort.current = request; setBusy("review"); setMessage(""); setPreview(null);
    try {
      const decisions = paths.map(path => !selected.includes(path) ? { path, status: "rejected" } : Object.is(original[path], draft[path]) ? { path, status: "confirmed" } : { path, status: "edited", value: draft[path] });
      const next = await apiRequest<Review>(`/api/v1/intelligence/parses/${review.result_id}`, { method: "PATCH", body: JSON.stringify({ expected_revision: review.revision, decisions, confirm: true }), signal: request.signal });
      if (request.signal.aborted) return; setReview(next);
      const result = await apiRequest<Preview>(`/api/v1/intelligence/parses/${review.result_id}/apply`, { method: "POST", body: JSON.stringify({ expected_revision: next.revision, expected_profile_updated_at: stamp.current, confirm: false }), signal: request.signal });
      if (!request.signal.aborted) { setPreview(result); setMessage("Review the changes below, then confirm saving. Nothing has been written to your profile yet."); }
    } catch (error) { if (!request.signal.aborted) setMessage(aiErrorMessage(error, "These changes need further review. No profile data has changed. Check complete records and valid values, or continue manually.")); }
    finally { if (abort.current === request) setBusy(""); }
  }
  async function save() {
    if (!review || !preview?.applied_paths.length || editing || stamp.current !== profileUpdatedAt) return;
    const request = new AbortController(); abort.current = request; setBusy("save"); setMessage("");
    try {
      const result = await apiRequest<Preview>(`/api/v1/intelligence/parses/${review.result_id}/apply`, { method: "POST", body: JSON.stringify({ expected_revision: review.revision, expected_profile_updated_at: stamp.current, confirm: true }), signal: request.signal });
      if (request.signal.aborted) return;
      if (!result.saved && !result.already_applied) throw new Error("not saved");
      setReview(null); setPreview(null); setFile(null); setConsent(false); setMessage("Your reviewed profile changes have been saved. Contact details, privacy choices and saved resume are unchanged."); router.refresh();
    } catch (error) { if (!request.signal.aborted) {setPreview(null); setMessage(aiErrorMessage(error, "Saving could not be confirmed. Refresh your profile before trying again. A confirmed operation is applied only once."));} }
    finally { if (abort.current === request) setBusy(""); }
  }
  // Extraction aliases and taxonomy IDs remain private lineage, not duplicate
  // user inputs. Hidden aliases are rejected in the complete server review.
  const visiblePaths = paths.filter(path => !/\/(id|namespace)$/.test(path) && !(path.endsWith("/raw_value") && original[path.replace(/raw_value$/, "name")] != null));
  const grouped = visiblePaths.reduce<Record<string, string[]>>((groups, path) => { const section = path.split("/")[1]; (groups[section] ||= []).push(path); return groups; }, {});
  return <details className="min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5">
    <summary className="min-h-11 cursor-pointer text-sm font-bold text-navy">Review profile suggestions from a CV with AI</summary>
    <section aria-label="Review CV with AI" className="mt-3 grid min-w-0 gap-3">
      <p className="text-sm leading-6 text-ink-muted">Upload a separate copy for a private, scanned proposal. Review every change before saving. This does not replace your saved resume.</p>
      <label className="grid gap-2 text-sm font-semibold text-ink">CV for AI review<input type="file" accept=".pdf,.docx" disabled={Boolean(busy) || editing} onChange={event => { setFile(event.target.files?.[0] || null); setReview(null); setPreview(null); }} className={control} /></label>
      <p className="text-xs text-ink-muted">PDF or DOCX · up to 1.5 MB. Scanning and extraction must pass before any AI processing.</p>
      <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" disabled={Boolean(busy)} checked={consent} onChange={event => setConsent(event.target.checked)} className="h-4 w-4 accent-blue-600" />Allow this CV to be sent to the AI provider for profile suggestions.</label>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={Boolean(busy) || editing || !profileUpdatedAt || !capability.available} onClick={parse}>{busy === "parse" ? "Scanning and parsing CV…" : "Prepare CV suggestions"}</Button>{busy === "parse" && <Button type="button" variant="secondary" onClick={() => { abort.current?.abort(); setBusy(""); setMessage("Parsing cancelled. Your profile is unchanged. A request already admitted may still finish; it will never save automatically."); }}>Cancel CV parsing</Button>}</div>
      {busy === "parse" && <p role="status" className="text-sm text-ink-muted">This can take 20–30 seconds. You can cancel or continue reading your profile.</p>}
      {!capability.loading && !capability.available && <p className="text-sm text-ink-muted">AI CV review is not enabled for your account. Your resume upload and manual profile editors remain available.</p>}
      {review && <div className="grid min-w-0 gap-4 border-t border-line pt-4">
        <h3 ref={heading} tabIndex={-1} className="scroll-mt-24 text-lg font-bold text-navy">Review CV suggestions</h3>
        <p className="text-sm text-ink-muted">Choose only the facts you want to use. Unselected fields are rejected. Existing records are kept; incomplete dates and fields without a compatible editor stay as manual suggestions.</p>
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">{Object.entries(grouped).map(([group, items]) => <fieldset key={group} disabled={Boolean(busy) || editing} className="min-w-0 rounded-lg border border-line p-3"><legend className="px-1 text-sm font-bold capitalize text-navy">{group.replaceAll("_", " ")}</legend><div className="grid gap-3">{items.map(path => <div key={path} className="grid min-w-0 gap-1">
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" checked={selected.includes(path)} onChange={event => { setSelected(old => event.target.checked ? [...old, path] : old.filter(p => p !== path)); invalidate(); }} className="h-4 w-4 accent-blue-600" />Use {label(path)}</label>
          {typeof original[path] === "boolean" ? <select aria-label={`Proposed ${label(path)}`} value={String(draft[path] ?? original[path])} onChange={event => { setDraft(old => ({ ...old, [path]: event.target.value === "true" })); invalidate(); }} className={control}><option value="true">Yes</option><option value="false">No</option></select> : <textarea aria-label={`Proposed ${label(path)}`} rows={1} value={String(draft[path] ?? original[path])} onChange={event => { setDraft(old => ({ ...old, [path]: typeof original[path] === "number" && event.target.value.trim()!=="" ? Number(event.target.value) : event.target.value })); invalidate(); }} className={control} />}
          <p className="break-words text-xs text-ink-muted">Source: {review.fields[path]?.metadata.provenance?.section || "uploaded CV"} · {review.fields[path]?.metadata.confidence == null ? "Confidence unknown; human review required" : "Extraction confidence is not a verified fact"}</p>
        </div>)}</div></fieldset>)}</div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" disabled={Boolean(busy) || editing} checked={reviewed} onChange={event => setReviewed(event.target.checked)} className="h-4 w-4 accent-blue-600" />I reviewed the selected CV facts and want to preview profile changes.</label>
        <div className="flex flex-wrap gap-2"><Button type="button" disabled={Boolean(busy) || editing || !reviewed || !selected.length} onClick={prepare}>{busy === "review" ? "Checking reviewed changes…" : "Preview reviewed changes"}</Button><Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => { setReview(null); setPreview(null); setMessage("Suggestions discarded. Your profile is unchanged."); }}>Discard suggestions</Button></div>
        {preview && <div className="grid min-w-0 gap-3 rounded-lg border border-line p-3" aria-label="Profile change confirmation"><h4 className="font-bold text-navy">Confirm profile changes</h4><p className="text-sm text-ink-muted">Selected scalar values replace those fields. Complete new records are appended. Existing matching records are kept.</p><ul className="grid gap-1 text-sm text-ink">{preview.applied_paths.map(path => <li key={path} className="break-words">{label(path)}: <strong>{String(draft[path] ?? original[path])}</strong></li>)}</ul>{preview.manual_paths.length > 0 && <div className="text-sm text-ink-muted"><p>These suggestions will not be saved here. Complete them in the profile or verified contact editors:</p><ul>{preview.manual_paths.map(path => <li key={path}>{label(path)}</li>)}</ul></div>}<Button type="button" disabled={Boolean(busy) || editing || !preview.applied_paths.length} onClick={save}>{busy === "save" ? "Saving reviewed profile…" : "Confirm and save profile changes"}</Button></div>}
      </div>}
      {message && <p role="status" className="break-words text-sm text-ink">{message}</p>}
    </section>
  </details>;
}
