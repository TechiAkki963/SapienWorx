import { OutreachWorkspace, type OutreachCampaign, type OutreachSequence } from "@/components/recruiter/outreach-workspace";
import Link from "next/link";
import { WorkspaceState, recruiterSecondary } from "@/components/recruiter/workspace-ui";
import type { BulkMessageTemplate, BulkRecruiterJob } from "@/components/recruiter/bulk-inmail-drawer";
import type { TalentPoolCandidate } from "@/components/recruiter/talent-pool-selection";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { messagingAPI } from "@/lib/messaging-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function RecruiterOutreachPage() {
  await requireRole("recruiter");

  const responses = await Promise.all([
    messagingAPI<{ items: BulkMessageTemplate[] }>("/api/v1/recruiter/message-templates"),
    messagingAPI<{ items: OutreachSequence[] }>("/api/v1/recruiter/outreach/sequences"),
    messagingAPI<{ items: OutreachCampaign[] }>("/api/v1/recruiter/outreach/campaigns"),
    recruiterAPI<{ items: TalentPoolCandidate[] }>("/api/v1/recruiter/talent-pool"),
    recruiterAPI<{ items: BulkRecruiterJob[] }>("/api/v1/recruiter/jobs?status=active&limit=50"),
  ]).catch(() => null);

  if (!responses) return <RecruiterShell><div className="grid gap-4">
    <RecruiterProductHeader eyebrow="Talent engagement" title="Outreach" description="Manage saved outreach without losing your existing campaigns." />
    <WorkspaceState error title="Outreach is temporarily unavailable" description="We could not load the current workspace. No campaigns or messages have changed." action={<Link href="/recruiter/outreach" className={recruiterSecondary}>Retry outreach</Link>} />
  </div></RecruiterShell>;
  const [templateResponse, sequenceResponse, campaignResponse, talentResponse, jobResponse] = responses;

  return (
    <RecruiterShell>
      <div className="grid gap-4">
        <RecruiterProductHeader
          eyebrow="Structured candidate engagement"
          title="Outreach"
          description="Build reusable templates and follow-up sequences, then launch controlled outreach from your saved talent pool. Replies automatically stop future sequence steps."
        />

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
