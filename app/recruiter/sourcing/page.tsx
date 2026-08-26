import { Suspense } from "react";
import { RecruiterSourcingV2 } from "../../../components/recruiter-sourcing-v2";

export default function RecruiterSourcingPage() {
  return <Suspense fallback={null}><RecruiterSourcingV2 /></Suspense>;
}
