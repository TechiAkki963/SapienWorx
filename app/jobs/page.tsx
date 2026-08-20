import { PublicJobsPage } from "../../components/public-site";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ keywords?: string | string[] }> }) {
  return <PublicJobsPage search={await searchParams} />;
}
