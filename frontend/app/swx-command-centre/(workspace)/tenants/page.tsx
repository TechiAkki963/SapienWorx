import Link from "next/link";
import { VerificationActions, VerificationDocumentButton } from "@/components/admin/admin-actions";
import { adminAPI } from "@/lib/admin-server";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import type { VerificationList } from "@/lib/admin";
import { recruitmentDate } from "@/lib/admin-recruitment";

type Props = { searchParams: Promise<Record<string,string|string[]|undefined>> };
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
export default async function TenantGovernancePage({searchParams}:Props) {
  await requireAdminWorkspace("organizations.read");
  const params=await searchParams,status=first(params.status)||"pending";
  const company=first(params.company_id)||"",country=first(params.country)||"";
  const page=Math.max(1,Number(first(params.page)||1)||1);
  const href=(status:string,page=1)=>`/swx-command-centre/tenants?${new URLSearchParams({status,company_id:company,country,page:String(page)})}`;
  const query=new URLSearchParams({status,company_id:company,country,page:String(page),limit:"25"});
  const data=await adminAPI<VerificationList>(`/api/v1/admin/company-verifications?${query}`);
  const pages=Math.max(1,Math.ceil(data.total/data.limit));
  return <section className="min-w-0 space-y-5">
    <header className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Tenant governance</p>
      <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div className="min-w-0"><h1 className="text-3xl font-bold text-slate-950">Recruiter verification</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Review registered employers before their recruiters can access the hiring workspace. Opening a registration document is recorded in the immutable admin audit log.</p></div><nav aria-label="Verification status" className="flex shrink-0 flex-wrap gap-2">{["pending","approved","rejected"].map(value=><Link key={value} href={href(value)} aria-current={status===value?"page":undefined} className={`rounded-full px-3 py-2 text-xs font-bold capitalize ${status===value?"bg-indigo-600 text-white":"border border-slate-200 text-slate-600"}`}>{value}</Link>)}</nav></div>
      {(company||country)&&<p className="mt-4 break-all text-xs leading-5 text-slate-600">Reporting cohort: {company||"all organizations"} · registered country {country||"any"}. Status changes and pagination preserve this scope. <Link className="font-bold text-indigo-600" href={`/swx-command-centre/tenants?status=${status}`}>Clear scope</Link></p>}
    </header>
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Company","Recruiter","Submitted (UTC)","Document","Status","Actions"].map(label=><th scope="col" key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody>{data.items.length===0?<tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No {status} verification records.</td></tr>:data.items.map(item=><tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-4"><p className="font-bold text-slate-950">{item.company_name}</p><p className="mt-1 font-mono text-xs text-slate-400">{item.company_id}</p></td><td className="px-4 py-4 font-mono text-xs text-slate-600">{item.recruiter_user_id}</td><td className="px-4 py-4 text-xs text-slate-600">{recruitmentDate(item.created_at)}</td><td className="px-4 py-4"><VerificationDocumentButton verificationID={item.id} available={Boolean(item.registration_doc_url)}/></td><td className="px-4 py-4"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{item.status}</span></td><td className="px-4 py-4">{item.status==="pending"?<VerificationActions verificationID={item.id}/>:<span className="text-xs text-slate-400">Reviewed</span>}</td></tr>)}</tbody>
      </table>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"><span>{data.total.toLocaleString("en-IN")} records</span><div className="flex items-center gap-2"><Link aria-disabled={page<=1} tabIndex={page<=1?-1:undefined} href={href(status,Math.max(1,page-1))} className={`rounded-lg border px-3 py-2 ${page<=1?"pointer-events-none opacity-40":""}`}>Previous</Link><span className="text-xs">Page {page} of {pages}</span><Link aria-disabled={page>=pages} tabIndex={page>=pages?-1:undefined} href={href(status,Math.min(pages,page+1))} className={`rounded-lg border px-3 py-2 ${page>=pages?"pointer-events-none opacity-40":""}`}>Next</Link></div></footer>
  </section>;
}
