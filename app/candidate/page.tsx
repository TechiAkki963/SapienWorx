import { CandidateDashboard } from "../../components/candidate";
import { getCandidateDashboardSnapshot } from "../../lib/backend";

export const dynamic = "force-dynamic";

export default async function CandidatePage() { return <CandidateDashboard initialData={await getCandidateDashboardSnapshot()} />; }
