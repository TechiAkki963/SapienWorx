import Link from "next/link";

const progress = [
  ["12", "Applications"],
  ["5", "Saved jobs"],
  ["3", "Interviews"],
  ["2", "New opportunities"],
] as const;

const opportunities = [
  ["Product Manager", "Remote · Example role", "New"],
  ["UX Designer", "Hybrid · Example role", "Featured"],
  ["Data Analyst", "Remote · Example role", "Explore"],
] as const;

/**
 * A clearly labeled illustrative workspace, not a candidate's actual data or
 * a live endorsement. The navigation links point to real product routes.
 */
export function CareerPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[40rem] rounded-[1.5rem] border border-white bg-white p-3 shadow-[0_20px_65px_rgb(8_65_140_/_0.16)] sm:p-4">
      <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted">Illustrative candidate workspace</p>
      <div className="overflow-hidden rounded-[1rem] border border-line bg-[#f8fbff]">
        <div className="flex h-9 items-center justify-between border-b border-line bg-white px-3">
          <span className="text-xs font-extrabold text-navy"><span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo text-[9px] text-white">S</span>SapienWorx</span>
          <span className="h-5 w-5 rounded-full bg-[#c9e2ff]" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[8rem_minmax(0,1fr)]">
          <nav className="grid content-start gap-1 border-r border-line bg-white p-2 text-[9px] font-semibold text-ink-muted sm:p-3 sm:text-[11px]" aria-label="Candidate workspace preview">
            <Link className="rounded-md bg-indigo-soft px-2 py-2 text-indigo" href="/candidate">Home</Link>
            <Link className="rounded-md px-2 py-2 hover:bg-indigo-soft" href="/jobs">Find Jobs</Link>
            <Link className="rounded-md px-2 py-2 hover:bg-indigo-soft" href="/candidate/applications">Applications</Link>
            <Link className="rounded-md px-2 py-2 hover:bg-indigo-soft" href="/candidate/saved">Saved Jobs</Link>
            <Link className="rounded-md px-2 py-2 hover:bg-indigo-soft" href="/knowledge-hub">Knowledge Hub</Link>
            <Link className="rounded-md px-2 py-2 hover:bg-indigo-soft" href="/candidate/profile">Profile</Link>
          </nav>
          <div className="min-w-0 p-3 sm:p-4">
            <p className="font-serif text-base font-semibold text-navy sm:text-xl">Good morning, Alex</p>
            <p className="mt-0.5 text-[10px] text-ink-muted sm:text-xs">Here is an example of your career workspace.</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
              {progress.map(([count, label]) => (
                <div key={label} className="rounded-lg border border-line/80 bg-white p-2">
                  <p className="text-base font-extrabold text-navy sm:text-xl">{count}</p>
                  <p className="mt-0.5 text-[9px] leading-tight text-ink-muted sm:text-[10px]">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-line/80 bg-white p-2 sm:p-3">
              <p className="mb-2 text-[11px] font-extrabold text-navy">Recommended for you</p>
              {opportunities.map(([title, description, badge]) => (
                <div key={title} className="flex items-center gap-2 border-t border-line/60 py-2 first:border-t-0">
                  <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-soft text-[11px] font-bold text-indigo sm:inline-flex" aria-hidden="true">↗</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-bold text-navy sm:text-xs">{title}</p>
                    <p className="truncate text-[9px] text-ink-muted">{description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-indigo-soft px-1.5 py-0.5 text-[9px] font-bold text-indigo">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
