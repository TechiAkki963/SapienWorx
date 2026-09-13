type MetricItem = { label: string; value: string | number; hint?: string; emphasis?: "outcome" | "default" };

export function MetricStrip({ items }: { items: MetricItem[] }) {
  const volume = items.filter((item) => item.emphasis !== "outcome");
  const outcome = items.filter((item) => item.emphasis === "outcome");

  function metric(item: MetricItem) {
    return (
      <div key={item.label} className="rounded-2xl border border-line/70 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,33,63,0.03)]">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-ink-muted">{item.label}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="text-[1.7rem] font-bold leading-none tracking-[-0.045em] text-navy">{item.value}</p>
          {item.hint && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-ink-muted">{item.hint}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{volume.map(metric)}</div>
      {!!outcome.length && <div className="grid gap-3 sm:grid-cols-3">{outcome.map(metric)}</div>}
    </div>
  );
}
