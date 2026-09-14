import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function safeInternalPath(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return undefined;
  return candidate;
}

const candidateFeatures = [
  { title: "Discover relevant roles", body: "Search by title, skill, location and experience without losing context." },
  { title: "Track every application", body: "See each application in a clear stage-based list from submission onward." },
  { title: "Save what matters", body: "Keep promising jobs in one place and return to them when you are ready." },
  { title: "Build your candidate story", body: "Maintain a profile that gives recruiters useful context beyond the résumé." },
];

export default async function CandidateLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next);

  return (
    <AuthShell
      eyebrow="Candidate sign in"
      panelLabel="Your career, in one place"
      title="Pick up where your next opportunity left off."
      description="Sign in to continue your job search, review saved opportunities, follow application progress and keep your profile current."
      features={candidateFeatures}
      image="/images/people/auth-candidate.webp"
      imageAlt="Candidate professional in a softly lit modern workplace"
      tone="lavender"
    >
      <LoginForm role="candidate" nextPath={nextPath} />
    </AuthShell>
  );
}
