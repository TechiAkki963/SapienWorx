export type Subprocessor = {
  id: string;
  name: string;
  purpose: string;
  data_categories: string[];
  processing_locations: string[];
  website_url?: string;
  dpa_url?: string;
  effective_from: string;
};

export function SubprocessorRegister({
  items,
  error,
}: {
  items: Subprocessor[];
  error?: string;
}) {
  if (error) {
    return (
      <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (!items.length) {
    return (
      <p className="rounded-2xl border border-line bg-white p-6 text-sm leading-7 text-ink-muted">
        No active subprocessors are currently published in the register. Production launch should not proceed until every deployed processor is recorded here.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-line/80 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-navy">{item.name}</h2>
              <p className="mt-2 text-sm leading-7 text-ink-muted">{item.purpose}</p>
            </div>
            <span className="rounded-full bg-indigo-soft px-3 py-1 text-xs font-bold text-indigo">
              Effective {new Date(item.effective_from).toLocaleDateString("en-IN")}
            </span>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-bold text-navy">Data categories</dt>
              <dd className="mt-1 text-ink-muted">{item.data_categories?.join(", ") || "Not specified"}</dd>
            </div>
            <div>
              <dt className="font-bold text-navy">Processing locations</dt>
              <dd className="mt-1 text-ink-muted">{item.processing_locations?.join(", ") || "Not specified"}</dd>
            </div>
          </dl>
          {(item.website_url || item.dpa_url) && (
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-indigo">
              {item.website_url && (
                <a href={item.website_url} rel="noreferrer" target="_blank" className="hover:underline">
                  Provider website ↗
                </a>
              )}
              {item.dpa_url && (
                <a href={item.dpa_url} rel="noreferrer" target="_blank" className="hover:underline">
                  Data processing terms ↗
                </a>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
