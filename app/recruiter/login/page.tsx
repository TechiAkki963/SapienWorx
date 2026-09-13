import { EmailOtpLogin } from "../../../components/email-otp-auth";
import { HumanPortrait } from "../../../components/human-portrait";

export default function RecruiterLoginPage(){
  return <div className="portal-recruiter auth-human-wrap"><HumanPortrait role="recruiter" className="auth-human-overlay"/><EmailOtpLogin role="RECRUITER"/></div>;
}
