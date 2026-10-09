import { companyWorkspace } from "@/lib/company-server";
import { recruiterAPI } from "@/lib/recruiter-server";
import { CompanyShell } from "@/components/company/company-shell";
import { CompanyTeam } from "@/components/company/team-workspace";
import type { CompanyMember, CompanyInvitation } from "@/lib/company";
export default async function CompanyTeamPage() { const workspace = await companyWorkspace(); const data = await recruiterAPI<{
    members: CompanyMember[];
    invitations: CompanyInvitation[];
}>("/api/v1/company/team"); return <CompanyShell member={workspace.member}><CompanyTeam initial={data} currentID={workspace.member.user_id} owner={workspace.member.role === "primary_admin"} actorScope={workspace.member.scope}/></CompanyShell>; }
