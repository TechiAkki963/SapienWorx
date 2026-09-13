import { ProfileForm } from "@/components/candidate/profile-form";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { Surface } from "@/components/ui/surface";
import { CandidateProfile } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export default async function CandidateProfilePage() {
  let profile: CandidateProfile;
  try { profile = await candidateAPI<CandidateProfile>("/api/v1/candidate/profile"); } catch { return <WorkspaceError title="We couldn’t load your profile." />; }
  return <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-ink">Candidate profile</p><h1 className="mt-2 text-4xl font-bold tracking-[-0.045em]">Tell recruiters what matters.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Profile strength is a transparent completeness checklist. It does not rank you against other candidates.</p><Surface className="mt-6 p-5 sm:p-7"><ProfileForm profile={profile} /></Surface></div>;
}
