import Link from "next/link";

type MetricItem = { label: string; value: string | number; hint?: string; href: string };

export function MetricStrip({ items }: { items: MetricItem[] }) {
  function metric(item: MetricItem) {
    return (
      <Link href={item.href} key={item.label} aria-label={`View ${item.label.toLowerCase()}: ${item.value}`} className="group min-w-0 rounded-2xl border border-line/70 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(16,33,63,0.03)] transition hover:border-indigo/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo">
        <p className="text-xs font-extrabold uppercase tracking-[0.07em] text-ink-muted group-hover:text-indigo">{item.label}</p>
        <div className="mt-1.5 flex items-end justify-between gap-3">
          <p className="text-[1.75rem] font-bold leading-none tracking-[-0.045em] text-navy">{item.value}</p>
          {item.hint && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-ink-muted">{item.hint}</span>}
        </div>
      </Link>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{items.map(metric)}</div>
  );
}
