import { OutreachWorkspace, type OutreachCampaign, type OutreachSequence } from "@/components/recruiter/outreach-workspace";
import type { BulkMessageTemplate, BulkRecruiterJob } from "@/components/recruiter/bulk-inmail-drawer";
import type { TalentPoolCandidate } from "@/components/recruiter/talent-pool-selection";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { messagingAPI } from "@/lib/messaging-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function RecruiterOutreachPage() {
  await requireRole("recruiter");

  const [templateResponse, sequenceResponse, campaignResponse, talentResponse, jobResponse] = await Promise.all([
    messagingAPI<{ items: BulkMessageTemplate[] }>("/api/v1/recruiter/message-templates").catch(() => ({ items: [] })),
    messagingAPI<{ items: OutreachSequence[] }>("/api/v1/recruiter/outreach/sequences").catch(() => ({ items: [] })),
    messagingAPI<{ items: OutreachCampaign[] }>("/api/v1/recruiter/outreach/campaigns").catch(() => ({ items: [] })),
    recruiterAPI<{ items: TalentPoolCandidate[] }>("/api/v1/recruiter/talent-pool").catch(() => ({ items: [] })),
    recruiterAPI<{ items: BulkRecruiterJob[] }>("/api/v1/recruiter/jobs?status=active&limit=100").catch(() => ({ items: [] })),
  ]);

  return (
    <RecruiterShell>
      <div className="grid gap-4">
        <header>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo">Structured candidate engagement</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-navy sm:text-3xl">Outreach</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">
            Build reusable templates and follow-up sequences, then launch controlled outreach from your saved talent pool. Replies automatically stop future sequence steps.
          </p>
        </header>

        <OutreachWorkspace
          initialTemplates={templateResponse.items ?? []}
          initialSequences={sequenceResponse.items ?? []}
          initialCampaigns={campaignResponse.items ?? []}
          candidates={talentResponse.items ?? []}
          activeJobs={(jobResponse.items ?? []).filter((job) => job.status === "active")}
        />
      </div>
    </RecruiterShell>
  );
}
