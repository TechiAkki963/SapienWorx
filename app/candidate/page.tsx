import { CandidateDashboardV2 } from "../../components/candidate-dashboard-v2";
import { getCandidateDashboardSnapshot } from "../../lib/backend";

export const dynamic = "force-dynamic";

export default async function CandidatePage() {
  return <CandidateDashboardV2 initialData={await getCandidateDashboardSnapshot()} />;
}
