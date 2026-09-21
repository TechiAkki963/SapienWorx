import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

const candidateFeatures = [
  { title: "Create one career profile", body: "Keep your experience, location and profile context ready for every opportunity." },
  { title: "Find work with better filters", body: "Search by job, skill, location and experience from a candidate-first marketplace." },
  { title: "Stay clear on progress", body: "Follow applications through transparent stages instead of wondering what changed." },
  { title: "Keep opportunities organised", body: "Save jobs, receive meaningful notifications and manage your search from one workspace." },
];

export default function CandidateSignupPage() {
  return (
    <AuthShell
      eyebrow="Candidate registration"
      panelLabel="Start your next chapter"
      title="Build a profile that represents the person behind the résumé."
      description="Create your SapienWorx candidate account, verify your mobile number and start a more thoughtful job search."
      features={candidateFeatures}
      image="/images/people/candidate-signup.webp"
      imageAlt="Candidate getting ready to build her professional profile"
      imageMode="contain"
      reverseOnDesktop
      tone="mint"
    >
      <SignupForm />
    </AuthShell>
  );
}
