import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { adminAPI,AdminBackendError } from "@/lib/admin-server";
import type { AdminInterview,AdminRecruitmentList } from "@/lib/admin";
import { recruitmentQuery } from "@/lib/admin-recruitment";
import { adminSurface,InterviewRecords,RecruitmentFilters,RecruitmentPagination } from "@/components/admin/recruitment-workspace";

export default async function InterviewsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  await requireAdminWorkspace("recruitment.read"); const query=recruitmentQuery(await searchParams);
  let data:AdminRecruitmentList<AdminInterview>|null=null,invalid=false;
  try { data=await adminAPI(`/api/v1/admin/interviews?${query}`); } catch(error) { if(error instanceof AdminBackendError&&error.status===400) invalid=true; else throw error; }
  return <section className="min-w-0 space-y-5"><header className={adminSurface+" sm:p-8"}><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Recruitment oversight · read-only</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Interview oversight</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">Inspect schedules and recorded changes. Meeting URLs, private notes and feedback content are not part of routine administrative monitoring.</p><p className="mt-2 text-xs leading-6 text-slate-500">Organizer association does not prove who created an older record. Applied-date filters refer to the associated application, not the interview date.</p></header><RecruitmentFilters query={query} interviews/>{invalid&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">Invalid interview filters. Check IDs, stage, status, country and UTC timestamps.</p>}{data&&<><InterviewRecords items={data.items}/>{data.items.length===0&&<p className={adminSurface+" text-center text-sm text-slate-500"}>No interviews match these filters.</p>}<RecruitmentPagination data={data} query={query} path="/swx-command-centre/interviews"/></>}</section>;
}
