import { OutreachWorkspace } from "@/components/recruiter/outreach-workspace";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { messagingAPI } from "@/lib/messaging-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  await requireRole("recruiter");

  const [sequences, campaigns, templates, talent, jobs] = await Promise.all([
    messagingAPI<{ items: any[] }>("/api/v1/recruiter/outreach/sequences").catch(() => ({ items: [] })),
    messagingAPI<{ items: any[] }>("/api/v1/recruiter/outreach/campaigns").catch(() => ({ items: [] })),
    messagingAPI<{ items: any[] }>("/api/v1/recruiter/message-templates").catch(() => ({ items: [] })),
    recruiterAPI<{ items: any[] }>("/api/v1/recruiter/talent-pool").catch(() => ({ items: [] })),
    recruiterAPI<{ items: any[] }>("/api/v1/recruiter/jobs?status=active&limit=100").catch(() => ({ items: [] })),
  ]);

  return (
    <RecruiterShell>
      <OutreachWorkspace
        initialSequences={sequences.items ?? []}
        initialCampaigns={campaigns.items ?? []}
        initialTemplates={templates.items ?? []}
        candidates={talent.items ?? []}
        jobs={(jobs.items ?? []).filter((job) => job.status === "active")}
      />
    </RecruiterShell>
  );
}
