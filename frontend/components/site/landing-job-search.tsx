/**
 * Home-page search uses the same query parameters and experience values as /jobs.
 * Keep the form server-rendered and native so keyboard and no-JS journeys work.
 */
export function LandingJobSearch() {
  return (
    <section id="job-search" aria-labelledby="landing-search-heading" className="relative z-10 mx-auto w-full max-w-[var(--content-max)] px-[var(--page-gutter)] pb-12 sm:pb-16">
      <div className="rounded-[1.75rem] border border-line/80 bg-white p-4 shadow-[0_18px_50px_rgb(10_44_92_/_0.10)] sm:rounded-[2rem] sm:p-6 lg:p-7">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo">Find your fit</p>
            <h2 id="landing-search-heading" className="mt-1 font-serif text-[1.6rem] font-semibold tracking-[-0.035em] text-navy sm:text-[1.9rem]">Search opportunities that suit you.</h2>
          </div>
          <p className="text-sm text-ink-muted sm:pb-1">Start with a role, your experience or a location.</p>
        </div>

        <form action="/jobs" role="search" className="landing-search grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_auto] xl:items-end">
          <label htmlFor="home-q" className="grid min-w-0 gap-2 text-sm font-semibold text-navy">
            Job title or skill
            <input id="home-q" name="q" type="search" autoComplete="off" placeholder="e.g. Product designer" className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-[#f8fbff] px-4 text-sm font-normal text-ink outline-none placeholder:text-ink-muted/75 focus-visible:border-indigo focus-visible:ring-2 focus-visible:ring-indigo/20" />
          </label>

          <label htmlFor="home-experience" className="grid min-w-0 gap-2 text-sm font-semibold text-navy">
            Experience
            <select id="home-experience" name="experience" defaultValue="" className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-[#f8fbff] px-4 text-sm font-normal text-ink outline-none focus-visible:border-indigo focus-visible:ring-2 focus-visible:ring-indigo/20">
              <option value="">Any experience</option>
              <option value="0">Fresher / 0 years</option>
              <option value="1">1 year</option>
              <option value="2">2 years</option>
              <option value="3">3 years</option>
              <option value="5">5 years</option>
              <option value="8">8 years</option>
              <option value="10">10+ years</option>
            </select>
          </label>

          <label htmlFor="home-location" className="grid min-w-0 gap-2 text-sm font-semibold text-navy">
            Location
            <input id="home-location" name="location" type="search" autoComplete="address-level2" placeholder="City or remote" className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-[#f8fbff] px-4 text-sm font-normal text-ink outline-none placeholder:text-ink-muted/75 focus-visible:border-indigo focus-visible:ring-2 focus-visible:ring-indigo/20" />
          </label>

          <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo px-6 text-sm font-bold text-white shadow-sm transition hover:bg-violet-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/45 focus-visible:ring-offset-2 xl:w-auto">
            Search jobs <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="mt-4 text-xs leading-5 text-ink-muted">Or <a className="font-semibold text-indigo underline-offset-4 hover:underline focus-visible:underline" href="/jobs">browse all available jobs</a>.</p>
      </div>
    </section>
  );
}
