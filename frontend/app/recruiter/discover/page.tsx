import {talentAccess,TalentAccessNotice} from "@/components/company/talent-access";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { DiscoverTalentWorkspace } from "@/components/recruiter/discover-talent-workspace";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI, RecruiterBackendError } from "@/lib/recruiter-server";
import type { RecruiterDashboard } from "@/lib/recruiter";
import type { DiscoveryResults, DiscoveryValues, SearchRecord } from "@/lib/discovery";

export const dynamic = "force-dynamic";
export default async function DiscoverTalentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireRole("recruiter");
  const access=await talentAccess();if(!access.allowed)return <RecruiterShell><TalentAccessNotice owner={access.owner}/></RecruiterShell>;
  const params = await searchParams;
  const [savedResult, recentResult, workspaceResult] = await Promise.allSettled([
    recruiterAPI<{ items: SearchRecord[] }>("/api/v1/recruiter/saved-searches"),
    recruiterAPI<{ items: SearchRecord[] }>("/api/v1/recruiter/recent-searches"),
    recruiterAPI<RecruiterDashboard>("/api/v1/recruiter/dashboard"),
  ]);
  const saved = savedResult.status === "fulfilled" ? savedResult.value.items : [];
  const recent = recentResult.status === "fulfilled" ? recentResult.value.items : [];
  let initialValues = Object.fromEntries(Object.entries(params).filter(([key, value]) => key !== "search_id" && typeof value === "string")) as DiscoveryValues;
  let initialError = "";
  let editingSearch: SearchRecord | undefined;
  if (typeof params.search_id === "string") {
    try {
      const item = await recruiterAPI<SearchRecord>(`/api/v1/recruiter/saved-searches/${encodeURIComponent(params.search_id)}`);
      initialValues = item.filters;
      editingSearch = item;
    } catch (error) {
      initialValues = {};
      initialError = error instanceof RecruiterBackendError && [403, 404].includes(error.status)
        ? "This saved search is unavailable in your workspace."
        : "Your saved search could not be loaded. Try again shortly.";
    }
  }
  let results: DiscoveryResults | null = null;
  if (!initialError && Object.keys(initialValues).some(key => !["page","page_size","sort"].includes(key) && initialValues[key])) {
    try { results = await recruiterAPI<DiscoveryResults>(`/api/v1/recruiter/discover?${new URLSearchParams({ ...initialValues, page: initialValues.page || "1", page_size: initialValues.page_size || "25" })}`); }
    catch { initialError = "Candidate search is unavailable. Your criteria are retained; retry the search."; }
  }
  return <RecruiterShell><DiscoverTalentWorkspace userID={session.id} companyName={workspaceResult.status === "fulfilled" ? workspaceResult.value.company_name : "Your company workspace"} initialValues={initialValues} editingSearch={editingSearch} initialResults={results} initialError={initialError} saved={saved} recent={recent} /></RecruiterShell>;
}
