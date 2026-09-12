import { RecruiterDashboardV2 } from "../../components/recruiter-dashboard-v2";
import { getRecruiterDashboardSnapshot } from "../../lib/backend";

export const dynamic = "force-dynamic";

export default async function RecruiterPage() {
  return <RecruiterDashboardV2 initialData={await getRecruiterDashboardSnapshot()} />;
}
