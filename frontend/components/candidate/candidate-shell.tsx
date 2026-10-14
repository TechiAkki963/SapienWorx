import { cookies } from "next/headers";
import type { CandidateProfileSummary } from "@/lib/candidate";
import { CandidateFrame } from "./candidate-frame";
import { CandidateWorkspaceState } from "./candidate-workspace-state";
export async function CandidateShell({children,identity,name,userID}:{children:React.ReactNode;identity:CandidateProfileSummary|null;name:string;userID:string}) {
  const preferenceKey="swx-candidate-sidebar-"+userID;
  const initialCollapsed=(await cookies()).get(preferenceKey)?.value==="collapsed";
  return <CandidateWorkspaceState initialIdentity={identity}><div className="theme-surface candidate-workspace"><CandidateFrame name={name} initialCollapsed={initialCollapsed} preferenceKey={preferenceKey}>{children}</CandidateFrame></div></CandidateWorkspaceState>;
}
