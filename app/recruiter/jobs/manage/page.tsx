import { RecruiterJobList } from "../../../../components/recruiter";

type JobManagementSearchParams = {
  q?: string | string[];
  status?: string | string[];
  location?: string | string[];
  order?: string | string[];
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RecruiterJobManagementPage({
  searchParams,
}: {
  searchParams: Promise<JobManagementSearchParams>;
}) {
  const filters = await searchParams;
  return <RecruiterJobList initialFilters={{
    query: firstValue(filters.q),
    status: firstValue(filters.status),
    location: firstValue(filters.location),
    order: firstValue(filters.order),
  }} />;
}
