export default function AdminSystemPage() {
  return (
    <section className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">System health</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">Platform health & budget</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">This route will display live platform metrics and AWS SNS billing-cycle usage in Step 4.</p>
    </section>
  );
}
