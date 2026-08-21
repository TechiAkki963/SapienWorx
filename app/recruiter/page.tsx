import { RecruiterDashboard } from "../../components/recruiter";
import { getRecruiterDashboardSnapshot } from "../../lib/backend";

export const dynamic = "force-dynamic";

export default async function RecruiterPage() { return <RecruiterDashboard initialData={await getRecruiterDashboardSnapshot()} />; }
