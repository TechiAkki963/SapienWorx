import { EmailOtpLogin } from "../../components/email-otp-auth";
import { HumanPortrait } from "../../components/human-portrait";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ job?: string | string[]; ref?: string | string[]; source?: string | string[] }> }) {
  const params = await searchParams;
  return <div className="portal-candidate auth-human-wrap"><HumanPortrait role="candidate" className="auth-human-overlay"/><EmailOtpLogin role="CANDIDATE" jobId={typeof params.job === "string" ? params.job : undefined} referralCode={typeof params.ref === "string" ? params.ref : undefined} shareSource={typeof params.source === "string" ? params.source : undefined}/></div>;
}
