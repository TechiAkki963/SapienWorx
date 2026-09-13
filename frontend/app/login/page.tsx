import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function safeInternalPath(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return undefined;
  return candidate;
}

export default async function CandidateLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next);
  return <AuthShell eyebrow="For candidates" title="Your next opportunity starts with a human signal." description="Access saved jobs, applications and the candidate experience from one secure account." tone="lavender"><LoginForm role="candidate" nextPath={nextPath} /></AuthShell>;
}
