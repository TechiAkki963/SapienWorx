import { RecruiterDashboardCommand } from "../../components/recruiter-dashboard-command";
import { getRecruiterDashboardSnapshot } from "../../lib/backend";

export const dynamic = "force-dynamic";

export default async function RecruiterPage() { return <RecruiterDashboardCommand initialData={await getRecruiterDashboardSnapshot()} />; }
