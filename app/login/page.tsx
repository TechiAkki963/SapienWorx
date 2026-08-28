import { LoginPortal } from "../../components/auth";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ job?: string | string[]; ref?: string | string[]; source?: string | string[] }> }) {
  const { job, ref, source } = await searchParams;
  return <LoginPortal jobId={typeof job === "string" ? job : undefined} referralCode={typeof ref === "string" ? ref : undefined} shareSource={typeof source === "string" ? source : undefined} />;
}
