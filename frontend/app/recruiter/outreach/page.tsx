import { OutreachWorkspace } from "@/components/recruiter/outreach-workspace";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function RecruiterOutreachPage() {
  await requireRole("recruiter");
  return (
    <RecruiterShell>
      <div className="grid gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-indigo">Bulk outreach</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-.035em] text-navy">Sequences & templates</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">Build reusable candidate outreach while preserving SapienWorx consent, eligibility, cooldown and messaging safeguards.</p>
        </div>
        <OutreachWorkspace />
      </div>
    </RecruiterShell>
  );
}