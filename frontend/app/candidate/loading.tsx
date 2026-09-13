export default function CandidateLoading() {
  return <div className="grid animate-pulse gap-5" aria-label="Loading candidate workspace"><div className="h-48 rounded-[1.75rem] bg-lavender/45" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div className="h-28 rounded-[1.5rem] bg-white/70" key={index} />)}</div><div className="h-72 rounded-[1.75rem] bg-white/70" /></div>;
}
