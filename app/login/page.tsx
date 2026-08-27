import { LoginPortal } from "../../components/auth";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ job?: string | string[] }> }) {
  const { job } = await searchParams;
  return <LoginPortal jobId={typeof job === "string" ? job : undefined} />;
}
