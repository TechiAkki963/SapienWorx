import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { JobContext } from "@/components/recruiter/job-context";
import { InterviewsWorkspace } from "@/components/recruiter/interviews-workspace";
import { ownedRecruiterJob } from "@/lib/recruiter-job-server";
import { requireRole } from "@/lib/auth-server";
import type { Interview, PipelineList, RecruiterTeamMember } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";
export default async function InterviewsPage({ searchParams }: { searchParams: Promise<{ job_id?: string }> }) {
  const user = await requireRole("recruiter");
  const { job_id } = await searchParams;
  const job = job_id ? await ownedRecruiterJob(job_id) : null;
  const query = job_id ? `job_id=${encodeURIComponent(job_id)}` : "";
  const [interviews, pipeline, team] = await Promise.all([
    recruiterAPI<{items:Interview[]}>(`/api/v1/recruiter/interviews${query ? `?${query}` : ""}`),
    recruiterAPI<PipelineList>(`/api/v1/recruiter/pipeline?page=1&limit=50${query ? `&${query}` : ""}`),
    recruiterAPI<{items:RecruiterTeamMember[]}>("/api/v1/recruiter/team"),
  ]);
  return <RecruiterShell><div className="grid min-w-0 gap-5">{job && <JobContext job={job} active="Interviews"/>}<InterviewsWorkspace items={interviews.items} applications={pipeline.items} team={team.items} userID={user.id} initialNow={Date.now()}/></div></RecruiterShell>;
}
