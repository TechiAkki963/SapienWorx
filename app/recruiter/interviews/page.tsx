import { Suspense } from "react";
import { RecruiterInterviewsV2 } from "../../../components/recruiter-interviews-v2";

export default function RecruiterInterviewsPage() {
  return <Suspense fallback={null}><RecruiterInterviewsV2 /></Suspense>;
}
