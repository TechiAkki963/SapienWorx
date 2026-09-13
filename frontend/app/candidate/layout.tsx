import { CandidateShell } from "@/components/candidate/candidate-shell";
import { requireRole } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  await requireRole("candidate");
  return <CandidateShell>{children}</CandidateShell>;
}
