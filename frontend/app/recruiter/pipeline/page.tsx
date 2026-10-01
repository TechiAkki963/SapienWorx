import { ApplicationsWorkspace } from "@/components/recruiter/applications-workspace";
import type { ApplicationFilterValues } from "@/components/recruiter/application-filters";

export const dynamic = "force-dynamic";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<ApplicationFilterValues> }) {
  return <ApplicationsWorkspace searchParams={await searchParams} />;
}
