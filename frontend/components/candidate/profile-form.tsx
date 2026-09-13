"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { CandidateProfile } from "@/lib/candidate";

export function ProfileForm({ profile }: { profile: CandidateProfile }) {
  const [current, setCurrent] = useState(profile);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const noticeValue = String(data.get("notice_period_days") ?? "").trim();
    const payload = {
      full_name: data.get("full_name"),
      headline: data.get("headline"),
      current_city: data.get("current_city"),
      current_state: data.get("current_state"),
      country_code: data.get("country_code"),
      total_experience_months: Number(data.get("total_experience_months") ?? 0),
      notice_period_days: noticeValue === "" ? null : Number(noticeValue),
    };
    try {
      const updated = await apiRequest<CandidateProfile>("/api/v1/candidate/profile", { method: "PATCH", body: JSON.stringify(payload) });
      setCurrent(updated); setMessage("Profile updated.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not update profile."); }
    finally { setPending(false); }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div className="rounded-2xl bg-mint/45 p-4">
        <div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold text-ink">Profile strength</span><strong className="text-indigo">{current.profile_completion}%</strong></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-indigo transition-all" style={{ width: `${current.profile_completion}%` }} /></div>
      </div>
      {message && <p className="rounded-2xl bg-indigo-soft/45 p-3 text-sm text-ink" role="status">{message}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Full name" name="full_name" defaultValue={current.full_name} required />
        <Input label="Professional headline" name="headline" defaultValue={current.headline ?? ""} placeholder="e.g. Java developer · 3 years" />
        <Input label="Current city" name="current_city" defaultValue={current.current_city ?? ""} placeholder="Mumbai" />
        <Input label="State" name="current_state" defaultValue={current.current_state ?? ""} placeholder="Maharashtra" />
        <Input label="Country code" name="country_code" defaultValue={current.country_code} maxLength={2} />
        <Input label="Experience in months" name="total_experience_months" type="number" min={0} defaultValue={current.total_experience_months} />
        <Input label="Notice period in days" name="notice_period_days" type="number" min={0} defaultValue={current.notice_period_days ?? ""} />
        <Input label="Account email" value={current.email} readOnly disabled />
      </div>
      <div><Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button></div>
    </form>
  );
}
