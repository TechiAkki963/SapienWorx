import Link from "next/link";

import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { TalentPoolCandidate, TalentPoolSelection } from "@/components/recruiter/talent-pool-selection";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function TalentPoolPage() {
  await requireRole("recruiter");

  const { items } = await recruiterAPI<{ items: TalentPoolCandidate[] }>("/api/v1/recruiter/talent-pool");

  return (
    <RecruiterShell>
      <div className="grid gap-4 pb-28 sm:pb-24">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo">Private talent workspace</p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">Talent Pool</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">Revisit promising candidates and move from saved talent to targeted outreach without leaving the workspace.</p>
          </div>
          <div className="rounded-xl border border-[#dfeee9] bg-[#eefaf5] px-4 py-2 text-sm font-bold text-[#18775e]">{items.length} saved candidate{items.length === 1 ? "" : "s"}</div>
        </header>

        {items.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[#cfe8df] bg-[linear-gradient(145deg,#f4fbf8,#f7f5ff)] p-8 text-center">
            <p className="text-sm font-bold text-navy">Your talent pool is empty.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">Save promising candidates from the pipeline and they will appear here for future roles.</p>
            <Link href="/recruiter/pipeline" className="mt-5 inline-flex rounded-xl bg-[#24A47F] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(36,164,127,0.18)]">Browse pipeline</Link>
          </section>
        ) : (
          <TalentPoolSelection items={items} />
        )}
      </div>
    </RecruiterShell>
  );
}
