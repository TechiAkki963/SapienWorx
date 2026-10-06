import { CandidateSessionRenewal } from "@/components/auth/candidate-session-renewal";
export default async function SessionRenewalPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  let returnTo = "/candidate";
  const supplied = params.returnTo;
  if (
    supplied?.startsWith("/") &&
    !supplied.startsWith("//") &&
    !/[\\\u0000-\u001f]/.test(supplied)
  ) {
    const url = new URL(supplied, "https://candidate.invalid");
    if (
      url.origin === "https://candidate.invalid" &&
      /^\/(candidate(?:\/|$)|welcome$|onboarding(?:\/|$))/.test(url.pathname)
    )
      returnTo = url.pathname + url.search;
  }
  return <CandidateSessionRenewal returnTo={returnTo} />;
}
