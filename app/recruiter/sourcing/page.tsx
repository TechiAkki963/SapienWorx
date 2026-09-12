import { Suspense } from "react";
import { RecruiterSourcingCommand } from "../../../components/recruiter-sourcing-command";

export default function RecruiterSourcingPage() {
  return <Suspense fallback={null}><RecruiterSourcingCommand /></Suspense>;
}
