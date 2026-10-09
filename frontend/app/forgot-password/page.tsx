import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { getSessionUser } from "@/lib/auth-server";
import { recoveryNavigation } from "@/lib/recovery-navigation";
import { SERVER_API_URL } from "@/lib/server-api-url";
import { cookies } from "next/headers";

export default async function ForgotPasswordPage({searchParams}:{searchParams:Promise<{returnTo?:string;role?:string}>}) {
 const [query,user]=await Promise.all([searchParams,getSessionUser()]);
 const role=user?.role || (query.role==="recruiter" || query.returnTo==="/recruiter/login" ? "recruiter" : undefined);
 const navigation=recoveryNavigation(query.returnTo,user?.role || (role==="recruiter" ? "signed_out_recruiter" : undefined));
 if(!user && role==="recruiter"){navigation.href="/recruiter/login";navigation.signIn="/recruiter/login";navigation.label="sign in";}
 let accountEmail:string|undefined;
 if(user && (user.role==="recruiter" || user.role==="candidate")) {
   try { const response=await fetch(`${SERVER_API_URL}/api/v1/auth/recovery-context`,{headers:{Cookie:(await cookies()).toString()},cache:"no-store"});if(response.ok){const context=await response.json();if(context.user_id===user.id && typeof context.email==="string")accountEmail=context.email;} }catch{/* A recovery request remains available if the identity service is temporarily unavailable. */}
 }
 return <AuthShell eyebrow="Recovery" title="Return to your account securely." description="A reset code is sent to the verified email attached to your SapienWorx account." tone="lavender"><PasswordRecoveryForm navigation={navigation} accountEmail={accountEmail}/></AuthShell>;
}
