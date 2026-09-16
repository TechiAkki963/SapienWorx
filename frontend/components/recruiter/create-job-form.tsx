"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { RecruiterJob } from "@/lib/recruiter";

const educationOptions = [
  "Any Postgraduate",
  "Post Graduation Not Required",
  "M.Tech",
  "MCA",
  "MS/M.Sc(Science)",
  "MBA/PGDM",
  "LLM",
  "PG Diploma",
  "Any Graduate",
  "B.Tech / B.E.",
  "B.Sc",
  "B.C.A.",
  "Graduation Not Required",
  "B.A - Bachelor of Arts",
  "B.Com",
  "Diploma",
];

const controlClass = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-indigo/40 focus:ring-3 focus:ring-indigo-soft";
const labelClass = "grid gap-1.5 text-xs font-bold text-ink";

function optionalNumber(data: FormData, name: string): number | null {
  const raw = String(data.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function CreateJobForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const skills = String(data.get("required_skills") ?? "").split(",").map((skill) => skill.trim()).filter(Boolean);
    const education = data.getAll("education_requirements").map(String).filter(Boolean);
    const minExperienceMonths = Number(data.get("min_experience_months"));
    const maxExperienceMonths = optionalNumber(data, "max_experience_months");
    const minSalaryAmount = optionalNumber(data, "min_salary_amount");
    const maxSalaryAmount = optionalNumber(data, "max_salary_amount");
    const salaryCurrency = String(data.get("salary_currency") ?? "INR").trim().toUpperCase();

    if (!skills.length) {
      setError("Add at least one required skill so SapienWorx can match suitable candidates.");
      setBusy(false);
      return;
    }
    if (!education.length) {
      setError("Select at least one education requirement.");
      setBusy(false);
      return;
    }
    if (maxExperienceMonths !== null && maxExperienceMonths < minExperienceMonths) {
      setError("Maximum experience must be greater than or equal to minimum experience.");
      setBusy(false);
      return;
    }
    if (minSalaryAmount !== null && maxSalaryAmount !== null && maxSalaryAmount < minSalaryAmount) {
      setError("Maximum salary must be greater than or equal to minimum salary.");
      setBusy(false);
      return;
    }

    try {
      const job = await apiRequest<RecruiterJob>("/api/v1/recruiter/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: data.get("title"), department: data.get("department"), description: data.get("description"),
          employment_type: data.get("employment_type"), work_mode: data.get("work_mode"), city: data.get("city"), state: data.get("state"),
          country_code: "IN", min_experience_months: minExperienceMonths, max_experience_months: maxExperienceMonths, openings: Number(data.get("openings")),
          application_deadline: data.get("application_deadline") || null, publish: data.get("publish") === "on",
        }),
      });
      await Promise.all([
        apiRequest(`/api/v1/recruiter/jobs/${job.id}/skills`, { method: "PATCH", body: JSON.stringify({ skills }) }),
        apiRequest(`/api/v1/recruiter/jobs/${job.id}/education`, { method: "PATCH", body: JSON.stringify({ education }) }),
        apiRequest(`/api/v1/recruiter/jobs/${job.id}/compensation`, { method: "PATCH", body: JSON.stringify({ min_salary_amount: minSalaryAmount, max_salary_amount: maxSalaryAmount, salary_currency: salaryCurrency }) }),
      ]);
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create job.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Post a job</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="create-job-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-[0_24px_80px_rgba(7,29,73,0.28)] sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line/70 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <div><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-indigo">New vacancy</p><h2 id="create-job-title" className="mt-1 text-xl font-bold text-navy">Post a job</h2><p className="mt-1 text-xs text-ink-muted">Create the vacancy first; skills, experience and compensation improve candidate discovery.</p></div>
              <button type="button" onClick={() => !busy && setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg text-ink-muted transition hover:bg-slate-50 hover:text-ink" aria-label="Close create job dialog">×</button>
            </div>

            <form onSubmit={submit} className="p-5 sm:p-6">
              {error && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <label className={labelClass}>Job title<input name="title" required className={controlClass} placeholder="Senior Backend Engineer" /></label>
                <label className={labelClass}>Department<input name="department" className={controlClass} placeholder="Engineering" /></label>
                <label className={labelClass}>Employment type<select name="employment_type" className={controlClass}><option value="full_time">Full time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="part_time">Part time</option><option value="temporary">Temporary</option></select></label>
                <label className={labelClass}>Work mode<select name="work_mode" className={controlClass}><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label>
                <label className={labelClass}>City<input name="city" className={controlClass} placeholder="Mumbai" /></label>
                <label className={labelClass}>State<input name="state" className={controlClass} placeholder="Maharashtra" /></label>
                <label className={labelClass}>Minimum experience (months)<input name="min_experience_months" type="number" min="0" defaultValue="0" className={controlClass} /></label>
                <label className={labelClass}>Maximum experience (months)<input name="max_experience_months" type="number" min="0" className={controlClass} placeholder="60" /></label>
                <label className={labelClass}>Minimum annual salary<input name="min_salary_amount" type="number" min="0" step="1000" className={controlClass} placeholder="1200000" /></label>
                <label className={labelClass}>Maximum annual salary<input name="max_salary_amount" type="number" min="0" step="1000" className={controlClass} placeholder="1800000" /></label>
                <label className={labelClass}>Salary currency<select name="salary_currency" defaultValue="INR" className={controlClass}><option value="INR">INR</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="AED">AED</option></select></label>
                <label className={labelClass}>Openings<input name="openings" type="number" min="1" defaultValue="1" className={controlClass} /></label>
                <label className={`${labelClass} md:col-span-2`}>Application deadline<input name="application_deadline" type="date" className={controlClass} /></label>
                <label className={`${labelClass} md:col-span-2`}>Required skills<input name="required_skills" required className={controlClass} placeholder="Java, Spring Boot, PostgreSQL, AWS" /><span className="font-normal text-ink-muted">Use comma-separated skills. These power the 65%+ candidate recommendation rule.</span></label>

                <fieldset className="rounded-2xl border border-line bg-slate-50/45 p-4 md:col-span-2">
                  <legend className="px-1 text-xs font-extrabold text-navy">Education requirements</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {educationOptions.map((option) => <label key={option} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink-muted hover:bg-white"><input type="checkbox" name="education_requirements" value={option} className="h-4 w-4 rounded border-line" />{option}</label>)}
                  </div>
                </fieldset>

                <label className={`${labelClass} md:col-span-2`}>Job description<textarea name="description" required rows={6} className={`${controlClass} min-h-36 py-3`} placeholder="Responsibilities, outcomes, requirements and team context" /></label>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" name="publish" className="h-4 w-4 rounded border-line" />Publish immediately</label>
                <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create job"}</Button></div>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
