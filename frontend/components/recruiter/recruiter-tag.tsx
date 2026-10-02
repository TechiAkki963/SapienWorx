type RecruiterTagProps = {
  label: string;
  className?: string;
};

/** Recruiter-authored organisational tag. Keep distinct from skills and workflow statuses. */
export function RecruiterTag({ label, className = "" }: RecruiterTagProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border border-indigo/15 bg-indigo-soft/55 px-2.5 py-1 text-[11px] font-bold leading-none text-indigo ${className}`}
      title={label}
    >
      <span className="max-w-[12rem] truncate">{label}</span>
    </span>
  );
}

export function RecruiterTagList({ tags, emptyLabel = "No tags yet", className = "" }: { tags: string[]; emptyLabel?: string; className?: string }) {
  if (!tags.length) return <span className={`text-xs text-ink-muted ${className}`}>{emptyLabel}</span>;
  return <div className={`flex min-w-0 flex-wrap gap-1.5 ${className}`}>{tags.map((tag) => <RecruiterTag key={tag} label={tag} />)}</div>;
}
