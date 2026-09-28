import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { adminAPI,AdminBackendError } from "@/lib/admin-server";
import type { AdminApplication,AdminRecruitmentList } from "@/lib/admin";
import { recruitmentQuery } from "@/lib/admin-recruitment";
import { adminSurface,ApplicationsRecords,RecruitmentFilters,RecruitmentPagination } from "@/components/admin/recruitment-workspace";

export default async function ApplicationsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  await requireAdminWorkspace("recruitment.read"); const query=recruitmentQuery(await searchParams);
  let data:AdminRecruitmentList<AdminApplication>|null=null,invalid=false;
  try { data=await adminAPI(`/api/v1/admin/applications?${query}`); } catch(error) { if(error instanceof AdminBackendError && error.status===400) invalid=true; else throw error; }
  return <section className="min-w-0 space-y-5"><header className={adminSurface+" sm:p-8"}><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Recruitment oversight · read-only</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Applications & outcomes</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">Inspect candidate–job relationships and recorded workflow history without changing the hiring pipeline. Offers and hires here describe current stages, not independent offer or employment ledgers.</p><p className="mt-2 text-xs leading-6 text-slate-500">Country refers to organization registration. Candidate IDs are identifiers, not links granting access to profiles, CVs or contacts.</p></header><RecruitmentFilters query={query}/>{invalid&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">Invalid recruitment filters. Use valid UUIDs, a supported stage, a two-letter country and an ordered UTC timestamp range.</p>}{data&&<><ApplicationsRecords items={data.items}/>{data.items.length===0&&<p className={adminSurface+" text-center text-sm text-slate-500"}>No applications match these filters.</p>}<RecruitmentPagination data={data} query={query} path="/swx-command-centre/applications"/></>}</section>;
}
