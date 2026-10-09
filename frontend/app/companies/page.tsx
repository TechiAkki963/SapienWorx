import Link from "next/link";
import { SERVER_API_URL } from "@/lib/server-api-url";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";
import type { PublicCompany } from "@/lib/company";
export const dynamic = "force-dynamic";
export default async function CompaniesPage({ searchParams }: {
    searchParams: Promise<{
        q?: string;
        page?: string;
    }>;
}) { const params = await searchParams; const page = Math.max(1, Math.floor(Number(params.page ?? 1)) || 1); const q = params.q ?? ""; const response = await fetch(`${SERVER_API_URL}/api/v1/companies?${new URLSearchParams({ q, page: String(page) })}`, { cache: "no-store" }); if (!response.ok)
    throw new Error("Company directory is unavailable."); const data = await response.json() as {
    items: PublicCompany[];
    total: number;
}; return <div className="theme-surface swx-recruiter-workspace min-h-screen bg-[#f5f7fb] text-ink"><header className="border-b border-line bg-white p-4"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/"><Wordmark /></Link><ThemeModeControl compact/></div></header><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><p className="text-sm font-medium text-indigo">Explore companies</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-navy">Make your next move informed.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-ink-muted">Company information, open roles and verified experiences. Employee and interview ratings stay separate.</p><form action="/companies" className="my-7 flex flex-wrap gap-3"><label className="min-w-48 flex-1 text-sm font-medium">Company name<input name="q" maxLength={160} defaultValue={q} className="mt-2 block min-h-11 w-full rounded-lg border border-line bg-white px-4"/></label><button className="min-h-11 self-end rounded-lg bg-indigo px-5 text-sm font-semibold text-white">Search companies</button></form><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.items.map(c => <Link key={c.id} href={`/companies/${c.id}`} className="rounded-xl border border-line bg-white p-6 hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo"><p className="text-lg font-semibold text-navy">{c.name}</p><p className="mt-2 text-sm text-ink-muted">{c.profile.industry || "Company"} · {c.city || c.country}</p><p className="mt-5 text-sm">{c.employee_rating ? `${c.employee_rating.toFixed(1)} ★ · ${c.employee_count} employee reviews` : "No employee rating yet"}</p><p className="mt-2 text-sm text-indigo">{c.open_jobs} open jobs →</p></Link>)}</div>{!data.items.length && <p className="rounded-xl border border-line bg-white p-8 text-sm text-ink-muted">No verified companies match your search.</p>}<nav aria-label="Company directory pages" className="mt-6 flex items-center justify-between text-sm"><span>{data.total} companies</span><div className="flex gap-4">{page > 1 && <Link href={`/companies?${new URLSearchParams({ q, page: String(page - 1) })}`}>Previous</Link>}{page * 20 < data.total && <Link href={`/companies?${new URLSearchParams({ q, page: String(page + 1) })}`}>Next</Link>}</div></nav></main></div>; }
