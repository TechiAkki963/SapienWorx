"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { RecruiterJob } from "@/lib/recruiter";

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
    const skills = String(data.get("required_skills") ?? "")
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    if (!skills.length) {
      setError("Add at least one required skill so SapienWorx can match suitable candidates.");
      setBusy(false);
      return;
    }

    try {
      const job = await apiRequest<RecruiterJob>("/api/v1/recruiter/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: data.get("title"),
          department: data.get("department"),
          description: data.get("description"),
          employment_type: data.get("employment_type"),
          work_mode: data.get("work_mode"),
          city: data.get("city"),
          state: data.get("state"),
          country_code: "IN",
          min_experience_months: Number(data.get("min_experience_months")),
          openings: Number(data.get("openings")),
          application_deadline: data.get("application_deadline") || null,
          publish: data.get("publish") === "on",
        }),
      });
      await apiRequest(`/api/v1/recruiter/jobs/${job.id}/skills`, {
        method: "PATCH",
        body: JSON.stringify({ skills }),
      });
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create job.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)}>Post a job</Button>;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-indigo/20 bg-indigo-soft/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Create job</h2>
          <p className="mt-1 text-xs text-ink-muted">Required skills power the candidate recommendation score.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-ink-muted hover:text-ink">Close</button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input name="title" required placeholder="Job title" className="rounded-xl border border-line bg-white px-3 py-2.5" />
        <input name="department" placeholder="Department" className="rounded-xl border border-line bg-white px-3 py-2.5" />
        <select name="employment_type" className="rounded-xl border border-line bg-white px-3 py-2.5"><option value="full_time">Full time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="part_time">Part time</option><option value="temporary">Temporary</option></select>
        <select name="work_mode" className="rounded-xl border border-line bg-white px-3 py-2.5"><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select>
        <input name="city" placeholder="City" className="rounded-xl border border-line bg-white px-3 py-2.5" />
        <input name="state" placeholder="State" className="rounded-xl border border-line bg-white px-3 py-2.5" />
        <input name="min_experience_months" type="number" min="0" defaultValue="0" placeholder="Min experience months" className="rounded-xl border border-line bg-white px-3 py-2.5" />
        <input name="openings" type="number" min="1" defaultValue="1" className="rounded-xl border border-line bg-white px-3 py-2.5" />
        <input name="application_deadline" type="date" className="rounded-xl border border-line bg-white px-3 py-2.5 md:col-span-2" />
        <input name="required_skills" required placeholder="Required skills, comma separated — Java, Spring Boot, PostgreSQL" className="rounded-xl border border-line bg-white px-3 py-2.5 md:col-span-2" />
        <textarea name="description" required rows={5} placeholder="Job description" className="rounded-xl border border-line bg-white px-3 py-2.5 md:col-span-2" />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="publish" />Publish immediately</label>
      <Button className="mt-4" type="submit" disabled={busy}>{busy ? "Saving…" : "Create job"}</Button>
    </form>
  );
}
