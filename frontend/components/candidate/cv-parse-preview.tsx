"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { CandidateProfile, CandidateProfileDetails } from "@/lib/candidate";

type ParsedField = { value: string; confidence: string; evidence: string; requires_review: boolean };
type ParsedRecord = { role?: string; company?: string; start?: string; end?: string; degree?: string; institution?: string; year?: string };
type Preview = { format: string; fields: Record<string, ParsedField>; skills: ParsedField[]; employment: ParsedRecord[]; education: ParsedRecord[]; links: string[]; warnings: string[] };
const labels: Record<string, string> = {
  full_name: "Full name", headline: "Professional title", current_designation: "Current designation", current_city: "Current city", current_state: "Current state", professional_summary: "Professional summary", total_experience_months: "Experience (months)",
};
const fieldOrder = ["full_name", "headline", "current_designation", "current_city", "current_state", "professional_summary", "total_experience_months"];

function records(details: Record<string, unknown>, key: string): Record<string, unknown>[] {
  return Array.isArray(details[key]) ? details[key].filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)) : [];
}

function normalized(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim();
}

function monthYear(value?: string) {
  const match = String(value ?? "").trim().match(/^(?:(\p{L}+)\s+)?((?:19|20)\d{2})$/u);
  return { month: match?.[1] ?? "", year: match?.[2] ?? "" };
}

function employmentRecord(item: ParsedRecord): Record<string, string> {
  const start = monthYear(item.start);
  const end = monthYear(item.end);
  return { company: item.company?.trim() ?? "", job_title: item.role?.trim() ?? "", joining_year: start.year, joining_month: start.month,
    current_company: /^(present|current)$/i.test(item.end ?? "") ? "Yes" : "No", end_year: end.year, end_month: end.month };
}

function educationRecord(item: ParsedRecord): Record<string, string> {
  return { level: item.degree?.trim() ?? "", university: item.institution?.trim() ?? "", end_year: item.year?.trim() ?? "" };
}

function sameEmployment(a: Record<string, unknown>, b: Record<string, unknown>) {
  return normalized(a.company) === normalized(b.company) && normalized(a.job_title) === normalized(b.job_title) && normalized(a.joining_year) === normalized(b.joining_year);
}

function sameEducation(a: Record<string, unknown>, b: Record<string, unknown>) {
  return normalized(a.level) === normalized(b.level) && normalized(a.university) === normalized(b.university) && normalized(a.end_year) === normalized(b.end_year);
}

export function CVParsePreview({ profile, extended, editing, onPreviewReady, onApplied }: { profile: CandidateProfile; extended: CandidateProfileDetails; editing: boolean; onPreviewReady?: () => void; onApplied?: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [skills, setSkills] = useState<string[]>([]);

  async function parse(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1500 * 1024 || !/\.(pdf|docx)$/i.test(file.name)) {
      setMessage("Select a PDF or DOCX smaller than 1.5 MB.");
      event.target.value = "";
      return;
    }
    setBusy(true); setMessage(""); setPreview(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("consent", String(consent));
      const result = await apiRequest<Preview>("/api/v1/candidate/cv/parse-preview", { method: "POST", body });
      setPreview(result);
      onPreviewReady?.();
      setDraft(Object.fromEntries(Object.entries(result.fields).map(([key, field]) => [key, field.value])));
      setSkills(result.skills.map(item => item.value));
      const details = extended.details ?? {};
      const existingEmployment = records(details, "employment");
      const existingEducation = records(details, "education");
      const nextSelected: Record<string, boolean> = {
        full_name: !profile.full_name,
        headline: !profile.headline,
        current_designation: !String(details.current_designation ?? "").trim(),
        current_city: !profile.current_city,
        current_state: !profile.current_state,
        professional_summary: !String(details.professional_summary ?? "").trim(),
        // Date-derived tenure is only a suggestion until employment dates are confirmed.
        total_experience_months: false,
        skills: result.skills.length > 0,
        professional_links: result.links.length > 0 && !String(details.professional_links ?? "").trim(),
      };
      result.employment.forEach((item, index) => { nextSelected[`employment_${index}`] = !existingEmployment.some(existing => sameEmployment(existing, employmentRecord(item))); });
      result.education.forEach((item, index) => { nextSelected[`education_${index}`] = !existingEducation.some(existing => sameEducation(existing, educationRecord(item))); });
      setSelected(nextSelected);
    } catch {
      setMessage("We couldn't prepare a preview from this CV. Try another file or continue creating your profile manually. Your saved details are unchanged.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function apply() {
    if (!preview || editing) return;
    setBusy(true); setMessage("");
    let liveProfile: CandidateProfile;
    let liveExtended: CandidateProfileDetails;
    try {
      [liveProfile, liveExtended] = await Promise.all([
        apiRequest<CandidateProfile>("/api/v1/candidate/profile"),
        apiRequest<CandidateProfileDetails>("/api/v1/candidate/profile/details"),
      ]);
    } catch {
      setMessage("Could not load your latest profile. Nothing was changed; please retry.");
      setBusy(false);
      return;
    }
    const coreChanged = ["full_name", "headline", "current_city", "current_state", "total_experience_months"].some(key => selected[key] && !!draft[key]?.trim());
    const core = {
      full_name: selected.full_name ? (draft.full_name ?? "").trim() : liveProfile.full_name,
      headline: selected.headline ? (draft.headline ?? "").trim() : liveProfile.headline ?? "",
      current_city: selected.current_city ? (draft.current_city ?? "").trim() : liveProfile.current_city ?? "",
      current_state: selected.current_state ? (draft.current_state ?? "").trim() : liveProfile.current_state ?? "",
      country_code: liveProfile.country_code,
      total_experience_months: selected.total_experience_months ? Number(draft.total_experience_months) : liveProfile.total_experience_months,
      notice_period_days: liveProfile.notice_period_days ?? null,
    };
    if (!core.full_name || !Number.isInteger(core.total_experience_months) || core.total_experience_months < 0 || core.total_experience_months > 720) {
      setMessage("Check the name and experience before applying."); setBusy(false); return;
    }
    const existing = liveExtended.details ?? {};
    const existingSkills = records(existing, "it_skills");
    const known = new Set(existingSkills.map(item => normalized(item.name)));
    const addedSkills = selected.skills ? skills.filter(skill => !known.has(normalized(skill))).map(name => ({ name })) : [];
    const existingEmployment = records(existing, "employment");
    const addedEmployment = preview.employment.filter((_, index) => selected[`employment_${index}`]).map(employmentRecord).filter(item => item.company && item.job_title && !existingEmployment.some(old => sameEmployment(old, item)));
    const existingEducation = records(existing, "education");
    const addedEducation = preview.education.filter((_, index) => selected[`education_${index}`]).map(educationRecord).filter(item => item.level && item.university && !existingEducation.some(old => sameEducation(old, item)));
    const existingLinks = String(existing.professional_links ?? "").split(/[\n,]+/).map(item => item.trim()).filter(Boolean);
    const addedLinks = selected.professional_links ? preview.links.filter(link => !existingLinks.some(old => normalized(old) === normalized(link))) : [];
    const detailChanged = !!(selected.professional_summary || (selected.current_designation && !!draft.current_designation?.trim()) || addedSkills.length || addedEmployment.length || addedEducation.length || addedLinks.length);
    if (!coreChanged && !detailChanged) {
      setMessage("Select at least one new suggestion to apply."); setBusy(false); return;
    }
    const details = { ...existing,
      ...(selected.professional_summary ? { professional_summary: (draft.professional_summary ?? "").trim() } : {}),
      ...(selected.current_designation && draft.current_designation?.trim() ? { current_designation: draft.current_designation.trim() } : {}),
      ...(addedSkills.length ? { it_skills: [...existingSkills, ...addedSkills] } : {}),
      ...(addedEmployment.length ? { employment: [...existingEmployment, ...addedEmployment] } : {}),
      ...(addedEducation.length ? { education: [...existingEducation, ...addedEducation] } : {}),
      ...(addedLinks.length ? { professional_links: [...existingLinks, ...addedLinks].join("\n") } : {}),
    };
    try {
      // The existing API separates core and extended details. Preserve every
      // unrelated value and tell the candidate if the second write fails.
      if (coreChanged) await apiRequest("/api/v1/candidate/profile", { method: "PATCH", body: JSON.stringify(core) });
      try {
        if (detailChanged) {
          await apiRequest("/api/v1/candidate/profile/details", { method: "PATCH", body: JSON.stringify({
            details,
            current_salary_amount: liveExtended.current_salary_amount ?? null,
            current_salary_currency: liveExtended.current_salary_currency || "INR",
            expected_salary_amount: liveExtended.expected_salary_amount ?? null,
            expected_salary_currency: liveExtended.expected_salary_currency || "INR",
          }) });
        }
      } catch {
        setMessage(coreChanged ? "Core details saved, but work history, education, or other details could not be saved. Please review your profile before retrying." : "The selected details could not be saved. Please retry.");
        router.refresh(); return;
      }
      setMessage("Selected details saved. Review your refreshed profile and correct anything the parser missed.");
      setPreview(null);
      onApplied?.();
      router.refresh();
    } catch { setMessage("Could not save these suggestions. Nothing from the CV was applied automatically."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-[1.5rem] border border-indigo/15 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="cv-preview-title">
    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo">Local preview</p>
    <h2 id="cv-preview-title" className="mt-1 text-lg font-bold text-navy">Fill details from a CV</h2>
    <p className="mt-1 text-xs leading-5 text-ink-muted">Test a PDF or DOCX privately, including a scanned PDF where local text recognition is available. Suggestions are not saved until you review and apply them. Existing details stay unchanged unless you select their replacements.</p>
    <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-navy"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo" /><span>I consent to processing this CV in memory for a private profile preview.</span></label>
    <button type="button" disabled={!consent || busy || editing} onClick={() => input.current?.click()} className="mt-3 min-h-10 rounded-xl bg-indigo px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? "Working…" : "Choose CV for preview"}</button>
    <input ref={input} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={parse} className="sr-only" tabIndex={-1} aria-hidden="true" />
    {editing && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><p>Profile editing is open. Save those edits first, then apply your CV selections so neither set of changes overwrites the other.</p><button type="submit" form="candidate-profile-edit-form" data-save-and-close className="mt-2 min-h-10 rounded-lg border border-amber-300 bg-white px-3 font-bold">Save editor & enable CV apply</button></div>}
    {message && <p role="status" className="mt-3 rounded-lg bg-indigo-soft/55 p-2 text-xs text-navy">{message}</p>}
    {preview && <div className="mt-5 space-y-4 border-t border-line pt-4">
      <div><p className="text-sm font-bold text-navy">Review suggestions from {preview.format}</p><p className="text-xs text-ink-muted">Heuristic results—not verified facts. Confirm employment dates before selecting calculated experience. Tick existing fields only if you want to replace them. Sign-in email and phone are never changed by this tool.</p></div>
      {preview.fields.current_company && <p className="rounded-lg bg-indigo-soft/40 p-3 text-xs text-navy">Suggested current employer: <strong>{preview.fields.current_company.value}</strong>. Check the ongoing role in work history before saving it.</p>}
      <div className="grid gap-3">{fieldOrder.filter(key => preview.fields[key]).map(key => <label key={key} className="rounded-xl border border-line bg-canvas/40 p-3"><span className="flex items-center gap-2 text-xs font-semibold text-navy"><input type="checkbox" checked={!!selected[key]} onChange={event => setSelected(previous => ({ ...previous, [key]: event.target.checked }))} className="h-4 w-4 accent-indigo" />{labels[key]} <span className="ml-auto font-normal text-amber-700">Review</span></span>{key === "professional_summary" ? <textarea value={draft[key] ?? ""} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.value }))} maxLength={500} className="mt-2 min-h-20 w-full rounded-lg border border-line bg-white p-2 text-sm text-navy" /> : <input value={draft[key] ?? ""} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.value }))} className="mt-2 min-h-10 w-full rounded-lg border border-line bg-white px-2 text-sm text-navy" />}</label>)}</div>
      {(preview.fields.email || preview.fields.phone) && <p className="rounded-lg bg-blue-50 p-3 text-xs text-navy">Contact found in CV: {[preview.fields.email?.value, preview.fields.phone?.value].filter(Boolean).join(" · ")}. These do not replace verified account contact details.</p>}
      {skills.length > 0 && <div><label className="flex items-center gap-2 text-xs font-bold text-navy"><input type="checkbox" checked={!!selected.skills} onChange={event => setSelected(previous => ({ ...previous, skills: event.target.checked }))} className="h-4 w-4 accent-indigo" />Add reviewed skills</label><div className="mt-2 flex flex-wrap gap-2">{skills.map(skill => <button type="button" key={skill} onClick={() => setSkills(previous => previous.filter(item => item !== skill))} aria-label={`Remove ${skill} suggestion`} className="rounded-full bg-indigo-soft px-2.5 py-1 text-xs font-semibold text-indigo">{skill} ×</button>)}</div></div>}
      {preview.employment.length > 0 && <div className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50/55 p-3 text-xs text-navy"><p className="font-bold">Work history to review</p>{preview.employment.map((item, index) => <label key={`work-${index}`} className="flex items-start gap-2 rounded-lg bg-white p-2"><input type="checkbox" checked={!!selected[`employment_${index}`]} onChange={event => setSelected(previous => ({ ...previous, [`employment_${index}`]: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-indigo" /><span><strong>{item.role || "Role not found"}</strong> · {item.company || "Company not found"} · {item.start || "Start unknown"}–{item.end || "End unknown"}</span></label>)}<p className="text-amber-800">Confirm names and dates. Unselected records will not change your profile.</p></div>}
      {preview.education.length > 0 && <div className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50/55 p-3 text-xs text-navy"><p className="font-bold">Education to review</p>{preview.education.map((item, index) => <label key={`edu-${index}`} className="flex items-start gap-2 rounded-lg bg-white p-2"><input type="checkbox" checked={!!selected[`education_${index}`]} onChange={event => setSelected(previous => ({ ...previous, [`education_${index}`]: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-indigo" /><span><strong>{item.degree || "Degree not found"}</strong> · {item.institution || "Institute not found"} · {item.year || "Year unknown"}</span></label>)}<p className="text-amber-800">Check degree, institution and year before saving.</p></div>}
      {preview.links.length > 0 && <label className="flex items-start gap-2 rounded-xl border border-line p-3 text-xs text-navy"><input type="checkbox" checked={!!selected.professional_links} onChange={event => setSelected(previous => ({ ...previous, professional_links: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-indigo" /><span><strong>Add professional links</strong><span className="mt-1 block break-all text-ink-muted">{preview.links.join(" · ")}</span></span></label>}
      {preview.warnings.map(warning => <p key={warning} className="text-xs text-amber-800">{warning}</p>)}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || editing || !Object.values(selected).some(Boolean)} onClick={() => void apply()} className="min-h-10 rounded-xl bg-indigo px-4 text-xs font-bold text-white disabled:opacity-50">Apply selected details</button><button type="button" onClick={() => setPreview(null)} className="min-h-10 rounded-xl border border-line px-4 text-xs font-semibold text-navy">Discard preview</button></div>
    </div>}
  </section>;
}
