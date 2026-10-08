import { Container } from "@/components/layout/container";
import { PublicHeader } from "@/components/site/public-header";

export default function JobsLoading() {
  return <main><PublicHeader /><Container className="py-12"><div className="grid animate-pulse gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]"><div className="h-80 rounded-[1.75rem] bg-white/70" /><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <div className="h-64 rounded-[1.75rem] bg-white/70" key={index} />)}</div></div></Container></main>;
}
