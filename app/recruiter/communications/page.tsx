import { Suspense } from "react";
import { RecruiterCommunicationsWorkspace } from "../../../components/recruiter-communications";

export default function RecruiterCommunicationsPage() {
  return <Suspense fallback={<div aria-busy="true">Loading communications…</div>}><RecruiterCommunicationsWorkspace /></Suspense>;
}
