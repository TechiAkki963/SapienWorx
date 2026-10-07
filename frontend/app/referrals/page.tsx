import {getSessionUser} from "@/lib/auth-server";
import {ReferralLanding} from "@/components/recruiter/referral-landing";
export const dynamic="force-dynamic";
export const metadata={title:"Your referral invitation | SapienWorx",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function ReferralPage(){const session=await getSessionUser();return <ReferralLanding signedIn={session?.role==="candidate"}/>}
