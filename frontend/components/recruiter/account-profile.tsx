"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/auth-server";
import { DashboardProfileCard } from "@/components/ui/dashboard-profile-card";
import { RecruiterDrawer } from "./workspace-ui";

export function RecruiterAccountProfile({ session, company, activeJobs }: { session: SessionUser; company: string; activeJobs: number }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-1 flex min-h-11 w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-ink-muted hover:bg-slate-50 hover:text-ink">My profile & photo</button>
    <RecruiterDrawer open={open} onClose={() => setOpen(false)} title="Your recruiter profile">
      <DashboardProfileCard firstName={session.first_name} lastName={session.last_name} headline={session.headline || `Talent Acquisition @ ${company}`} imageUrl={session.profile_image_url} statLabel="Active roles" statValue={activeJobs} />
      <p className="mt-4 text-sm leading-6 text-ink-muted">Your account photo is shared across your SapienWorx workspaces.</p>
    </RecruiterDrawer>
  </>;
}
