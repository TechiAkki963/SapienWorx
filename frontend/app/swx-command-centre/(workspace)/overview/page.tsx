export default function CommandCentreOverviewPage() {
  return (
    <section className="space-y-5">
      <div className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">Master Admin</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">Platform command centre</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">This secure workspace governs recruiter verification, user moderation, system health and platform budget controls. Step 4 will connect the live operational dashboard.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Tenant governance", "Review company registrations and recruiter access."],
          ["Users & moderation", "Search and moderate candidate or recruiter accounts."],
          ["System health", "Monitor platform activity and AWS SNS usage."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-[1.25rem] border border-[#e1e5ef] bg-white p-5 shadow-[0_8px_30px_rgba(23,37,84,0.035)]">
            <div className="h-1.5 w-10 rounded-full bg-[#6f78dd]" aria-hidden="true" />
            <h2 className="mt-4 text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
