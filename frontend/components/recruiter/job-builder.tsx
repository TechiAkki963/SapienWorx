"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { label, RecruiterJob } from "@/lib/recruiter";

type BuilderState = {
  title: string;
  department: string;
  employment_type: string;
  work_mode: string;
  role_category: string;
  location: string;
  min_experience_years: string;
  max_experience_years: string;
  min_salary_lakhs: string;
  max_salary_lakhs: string;
  description: string;
  responsibilities: string;
  company_overview: string;
  why_join: string;
  hiring_process: string;
};

const initialState: BuilderState = {
  title: "",
  department: "",
  employment_type: "full_time",
  work_mode: "hybrid",
  role_category: "Technology",
  location: "",
  min_experience_years: "",
  max_experience_years: "",
  min_salary_lakhs: "",
  max_salary_lakhs: "",
  description: "",
  responsibilities: "",
  company_overview: "",
  why_join: "",
  hiring_process: "Application review\nRecruiter conversation\nRole-focused conversation\nFinal team conversation and decision",
};

const steps = [
  { number: 1, title: "Role basics", subtitle: "Title, team and working model" },
  { number: 2, title: "Requirements", subtitle: "Experience, compensation and skills" },
  { number: 3, title: "Candidate story", subtitle: "Role, company and process" },
  { number: 4, title: "Publish & share", subtitle: "Final review and distribution" },
];

function optionalNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function ChipInput({ skills, setSkills }: { skills: string[]; setSkills: (next: string[]) => void }) {
  const [value, setValue] = useState("");

  function addSkill() {
    const skill = value.trim();
    if (!skill) return;
    if (!skills.some((item) => item.toLowerCase() === skill.toLowerCase())) setSkills([...skills, skill]);
    setValue("");
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSkill();
    }
  }

  return (
    <div>
      <label className="text-sm font-semibold text-ink">Skills</label>
      <div className="mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-sm focus-within:border-indigo/45 focus-within:ring-4 focus-within:ring-indigo-soft/50">
        {skills.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
            {skill}
            <button type="button" onClick={() => setSkills(skills.filter((item) => item !== skill))} className="text-blue-400 hover:text-blue-800" aria-label={`Remove ${skill}`}>×</button>
          </span>
        ))}
        <input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={keyDown} onBlur={addSkill} placeholder={skills.length ? "Add another skill" : "Add a skill and press Enter"} className="min-w-[11rem] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-ink-muted/65" />
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">These skills power candidate recommendations and matching.</p>
    </div>
  );
}

function TextareaField({ labelText, value, onChange, placeholder, rows = 6, hint }: { labelText: string; value: string; onChange: (value: string) => void; placeholder: string; rows?: number; hint?: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{labelText}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full resize-y rounded-xl border border-line bg-white px-3.5 py-3 text-sm leading-6 shadow-sm outline-none transition placeholder:text-ink-muted/60 focus:border-indigo/45 focus:ring-4 focus:ring-indigo-soft/50" />
      {hint && <span className="text-xs font-normal text-ink-muted">{hint}</span>}
    </label>
  );
}

function CandidatePreview({ companyName, state, skills }: { companyName: string; state: BuilderState; skills: string[] }) {
  const process = state.hiring_process.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 5);
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-line/70 bg-white shadow-[0_12px_32px_rgba(16,33,63,0.07)]">
        <div className="border-b border-line/60 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-indigo">Candidate-facing preview</p><h2 className="mt-1 text-lg font-bold text-navy">Published story</h2></div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-blue-700">Preview</span>
          </div>
        </div>
        <div className="p-5">
          <div className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-sm font-extrabold text-white">{companyName.trim().charAt(0).toUpperCase() || "S"}</div>
              <div><p className="text-xs font-bold text-ink">{companyName}</p><p className="text-[10px] font-semibold text-ink-muted">Verified employer</p></div>
            </div>
            <h3 className="mt-5 text-xl font-bold tracking-[-0.035em] text-navy">{state.title || "Your job title"}</h3>
            <p className="mt-1 text-xs text-ink-muted">{state.department || "Department or team"}</p>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] font-bold text-ink-muted">
              {state.min_experience_years && <span>{state.min_experience_years}{state.max_experience_years ? `–${state.max_experience_years}` : "+"} years</span>}
              <span>· {label(state.work_mode)}</span><span>· {label(state.employment_type)}</span>{state.location && <span>· {state.location}</span>}
            </div>
            {skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{skills.slice(0, 4).map((skill) => <span key={skill} className="rounded-md bg-blue-100/70 px-2 py-1 text-[10px] font-bold text-blue-800">{skill}</span>)}</div>}
            <p className="mt-4 line-clamp-5 text-xs leading-5 text-ink-muted">{state.description || "Your role summary will appear here as you write it."}</p>
            {process.length > 0 && <div className="mt-5 border-t border-line/60 pt-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Hiring process</p><ol className="mt-3 grid gap-2">{process.map((item, index) => <li key={`${item}-${index}`} className="flex items-start gap-2 text-[11px] font-semibold text-ink"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-extrabold text-blue-700">{index + 1}</span><span>{item}</span></li>)}</ol></div>}
            <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3 text-[9px] font-semibold text-ink-muted"><span>SapienWorx verified role</span><span className="text-indigo">View job →</span></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-muted">Internal compensation is never shown here. This card reflects only the candidate-facing story.</p>
        </div>
      </div>
    </aside>
  );
}

export function JobBuilder({ companyName }: { companyName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<BuilderState>(initialState);
  const [skills, setSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState<"draft" | "publish" | "">("");
  const [error, setError] = useState("");

  const publishReady = useMemo(() => Boolean(state.title.trim() && state.description.trim() && state.responsibilities.trim() && skills.length && state.hiring_process.split("\n").filter((item) => item.trim()).length >= 3), [state, skills]);

  function update<K extends keyof BuilderState>(key: K, value: BuilderState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function save(publish: boolean) {
    setError("");
    if (!state.title.trim()) {
      setStep(1);
      setError("Add a job title before saving this role.");
      return;
    }
    if (publish && !publishReady) {
      setStep(3);
      setError("Complete the role summary, responsibilities, at least one skill, and at least three hiring stages before publishing.");
      return;
    }
    setBusy(publish ? "publish" : "draft");
    try {
      await apiRequest<RecruiterJob>("/api/v1/recruiter/jobs/builder", {
        method: "POST",
        body: JSON.stringify({
          title: state.title,
          department: state.department,
          employment_type: state.employment_type,
          work_mode: state.work_mode,
          role_category: state.role_category,
          location: state.location,
          min_experience_years: Number(state.min_experience_years || 0),
          max_experience_years: optionalNumber(state.max_experience_years),
          min_salary_lakhs: optionalNumber(state.min_salary_lakhs),
          max_salary_lakhs: optionalNumber(state.max_salary_lakhs),
          skills,
          description: state.description,
          responsibilities: state.responsibilities,
          company_overview: state.company_overview,
          why_join: state.why_join,
          hiring_process: state.hiring_process.split("\n").map((item) => item.trim()).filter(Boolean),
          publish,
        }),
      });
      router.push("/recruiter/jobs");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this role.");
    } finally {
      setBusy("");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 4) setStep(step + 1);
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Job posting steps">
        {steps.map((item) => {
          const active = item.number === step;
          const completed = item.number < step;
          return <button key={item.number} type="button" onClick={() => setStep(item.number)} className={`rounded-xl border px-3.5 py-3 text-left transition ${active ? "border-indigo/40 bg-blue-50 shadow-sm" : completed ? "border-emerald-200 bg-emerald-50/45" : "border-line bg-white hover:border-indigo/25"}`}><div className="flex items-start gap-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${active ? "bg-indigo text-white" : completed ? "bg-emerald-100 text-emerald-700" : "border border-line bg-slate-50 text-ink-muted"}`}>{completed ? "✓" : item.number}</span><span><span className="block text-sm font-bold text-ink">{item.title}</span><span className="mt-0.5 block text-[11px] leading-4 text-ink-muted">{item.subtitle}</span></span></div></button>;
        })}
      </nav>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(16,33,63,0.03)]">
          <div className="border-b border-line/60 px-5 py-4 sm:px-6"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-indigo">Step {step} of 4</p><h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-navy">{steps[step - 1].title}</h2></div>
          <div className="p-5 sm:p-6">
            {step === 1 && <div className="grid gap-5">
              <Input label="Job title" value={state.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Senior Product Designer" required />
              <Input label="Department or team" value={state.department} onChange={(event) => update("department", event.target.value)} placeholder="e.g. Product design" />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-ink">Employment type<select value={state.employment_type} onChange={(event) => update("employment_type", event.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 shadow-sm outline-none focus:border-indigo/45 focus:ring-4 focus:ring-indigo-soft/50"><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="temporary">Temporary</option></select></label>
                <label className="grid gap-2 text-sm font-semibold text-ink">Workplace model<select value={state.work_mode} onChange={(event) => update("work_mode", event.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 shadow-sm outline-none focus:border-indigo/45 focus:ring-4 focus:ring-indigo-soft/50"><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-ink">Role category<select value={state.role_category} onChange={(event) => update("role_category", event.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 shadow-sm outline-none focus:border-indigo/45 focus:ring-4 focus:ring-indigo-soft/50">{["Technology","Product","Design","Sales","Marketing","Finance","Human Resources","Operations","Healthcare","Other"].map((option) => <option key={option}>{option}</option>)}</select></label>
              <Input label="Location" value={state.location} onChange={(event) => update("location", event.target.value)} placeholder="e.g. Bengaluru, India" />
            </div>}

            {step === 2 && <div className="grid gap-6">
              <div><h3 className="text-sm font-bold text-navy">Experience</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><Input label="Minimum years" type="number" min="0" value={state.min_experience_years} onChange={(event) => update("min_experience_years", event.target.value)} placeholder="e.g. 3" /><Input label="Maximum years" type="number" min="0" value={state.max_experience_years} onChange={(event) => update("max_experience_years", event.target.value)} placeholder="e.g. 6" /></div></div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/45 p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-navy">Internal compensation range</h3><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-amber-700">Private</span></div><div className="mt-3 grid gap-4 sm:grid-cols-2"><Input label="Minimum salary in lakhs" type="number" min="0" step="0.1" value={state.min_salary_lakhs} onChange={(event) => update("min_salary_lakhs", event.target.value)} placeholder="e.g. 12" /><Input label="Maximum salary in lakhs" type="number" min="0" step="0.1" value={state.max_salary_lakhs} onChange={(event) => update("max_salary_lakhs", event.target.value)} placeholder="e.g. 18" /></div><p className="mt-3 text-xs leading-5 text-ink-muted">Used for matching and internal reporting. SapienWorx does not display this range in the candidate-facing preview.</p></div>
              <ChipInput skills={skills} setSkills={setSkills} />
            </div>}

            {step === 3 && <div className="grid gap-5">
              <TextareaField labelText="Role summary" value={state.description} onChange={(value) => update("description", value)} placeholder="Describe the role, its purpose and what success looks like…" />
              <TextareaField labelText="Responsibilities" value={state.responsibilities} onChange={(value) => update("responsibilities", value)} placeholder="Add the outcomes and responsibilities candidates should understand before applying…" />
              <TextareaField labelText="Company overview" value={state.company_overview} onChange={(value) => update("company_overview", value)} placeholder="Introduce the company, its mission and the team this person will join." rows={4} />
              <TextareaField labelText="Why join" value={state.why_join} onChange={(value) => update("why_join", value)} placeholder="Give candidates honest reasons to consider this opportunity." rows={4} />
              <TextareaField labelText="Hiring process" value={state.hiring_process} onChange={(value) => update("hiring_process", value)} placeholder="Application review\nRecruiter conversation\nRole-focused conversation\nFinal team conversation and decision" rows={6} hint="Enter one stage per line. Use three to six stages so candidates know what to expect." />
            </div>}

            {step === 4 && <div className="grid gap-5">
              <div className="rounded-xl border border-line bg-slate-50/65 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Final review</p><h3 className="mt-1 text-lg font-bold text-navy">Ready to publish?</h3><p className="mt-1 text-sm leading-6 text-ink-muted">Review the candidate-facing preview and confirm the role information. Publishing makes this vacancy discoverable to candidates immediately.</p></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-line p-4"><p className="text-xs font-bold text-ink-muted">Role</p><p className="mt-1 font-bold text-ink">{state.title || "Untitled role"}</p><p className="mt-1 text-xs text-ink-muted">{state.department || "No team set"} · {label(state.work_mode)}</p></div><div className="rounded-xl border border-line p-4"><p className="text-xs font-bold text-ink-muted">Requirements</p><p className="mt-1 font-bold text-ink">{skills.length} skill{skills.length === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-ink-muted">{state.min_experience_years || "0"}{state.max_experience_years ? `–${state.max_experience_years}` : "+"} years experience</p></div></div>
              {!publishReady && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">To publish, complete the role summary, responsibilities, add at least one skill, and provide at least three hiring stages. You can still save this role as a draft.</div>}
            </div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 bg-slate-50/45 px-5 py-4 sm:px-6">
            <div className="flex gap-2">{step > 1 && <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>← Back</Button>}<Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => save(false)}>{busy === "draft" ? "Saving…" : "Save as draft"}</Button></div>
            {step < 4 ? <Button type="submit">Continue →</Button> : <Button type="button" disabled={Boolean(busy) || !publishReady} onClick={() => save(true)}>{busy === "publish" ? "Publishing…" : "Publish job"}</Button>}
          </div>
        </section>

        <CandidatePreview companyName={companyName} state={state} skills={skills} />
      </div>
    </form>
  );
}
