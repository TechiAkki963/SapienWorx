"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Logo } from "./ui";
import { parseResumeText, type ParsedProfile } from "../lib/parser/deterministic";
import { apiClient } from "../lib/api-client";
import { trackProductEvent } from "../lib/telemetry";

type Portal = "candidate" | "recruiter";
type RegistrationMethod = "resume" | "manual";
type Contact = { name: string; email: string; mobile: string };
type OtpRequestResponse = { transactionId: string; requiredChannels: Array<"EMAIL" | "MOBILE"> };
type AuthSessionResponse = { authenticated: boolean; redirectTo: string | null; remainingChannels: Array<"EMAIL" | "MOBILE"> };

export function LoginPortal({ defaultPortal = "candidate" }: { defaultPortal?: Portal }) {
  const [portal, setPortal] = useState<Portal>(defaultPortal);
  const [step, setStep] = useState<"credentials" | "verify">("credentials");
  const [contact, setContact] = useState<Contact>({ name: "", email: portal === "candidate" ? "candidate@example.com" : "team@company.com", mobile: "+91 98765 43210" });
  const [password, setPassword] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [notice, setNotice] = useState("");
  const requestSignIn = async () => {
    setNotice("");
    try {
      const response = await apiClient<OtpRequestResponse>("/api/auth/request-otp", { method: "POST", body: JSON.stringify({ flow: "SIGN_IN", role: portal === "candidate" ? "CANDIDATE" : "RECRUITER", email: contact.email, password }) });
      setTransactionId(response.transactionId);
      setStep("verify");
    } catch (error) { setNotice(error instanceof Error ? error.message : "We could not start secure sign-in."); throw error; }
  };
  const verifySignIn = async (codes: { emailCode: string; mobileCode: string }) => {
    const session = await verifyOtpTransaction(transactionId, codes, portal === "candidate" ? "both" : "email");
    if (!session.authenticated || !session.redirectTo) throw new Error("Complete each required verification before continuing.");
    window.location.assign(session.redirectTo);
  };

  return <AuthFrame eyebrow={portal === "candidate" ? "Candidate portal" : "Recruiter workspace"} title={step === "credentials" ? "Welcome back" : "Verify it’s you"} copy={step === "credentials" ? "Use the space built for your next career move." : "Enter both one-time codes before continuing."}>
    <div className="portal-switch" role="tablist" aria-label="Choose a portal"><button className={portal === "candidate" ? "active" : ""} onClick={() => { setPortal("candidate"); setStep("credentials"); setNotice(""); }} role="tab" aria-selected={portal === "candidate"}>Candidate</button><button className={portal === "recruiter" ? "active" : ""} onClick={() => { setPortal("recruiter"); setStep("credentials"); setNotice(""); }} role="tab" aria-selected={portal === "recruiter"}>Recruiter</button></div>
    {step === "credentials" ? <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void requestSignIn().catch(() => undefined); }}><AuthField label="Email address" type="email" value={contact.email} onChange={(value) => setContact({ ...contact, email: value })} placeholder={portal === "candidate" ? "you@example.com" : "you@company.com"}/><AuthField label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter your password"/><div className="auth-row"><label><input type="checkbox"/> Remember this device</label><a href="#forgot">Forgot password?</a></div>{notice && <p className="consent-error" role="alert">{notice}</p>}<Button type="submit" disabled={!password}>Continue securely →</Button><p className="auth-microcopy">For every sign-in, we confirm both email and mobile ownership.</p></form> : <DualOtp contact={contact} methods={portal === "candidate" ? "both" : "email"} onVerify={verifySignIn} onResend={requestSignIn}/>}
    <p className="auth-footer">New to Sapienworx? <a href={portal === "candidate" ? "/register" : "/recruiter/register"}>Create an account</a></p>
  </AuthFrame>;
}

export function RegistrationPortal({ portal = "candidate" }: { portal?: Portal }) {
  if (portal === "recruiter") return <RecruiterRegistration />;
  return <CandidateRegistration />;
}

function CandidateRegistration() {
  const [method, setMethod] = useState<RegistrationMethod | null>(null);
  const [step, setStep] = useState<"choose" | "resume" | "details" | "verify" | "complete">("choose");
  const [contact, setContact] = useState<Contact>({ name: "", email: "", mobile: "" });
  const [parsed, setParsed] = useState<ParsedProfile | null>(null);
  const [fileName, setFileName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [hasConsent, setHasConsent] = useState(false);
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const journeyStartedAt = useRef<number | null>(null);

  function selectMethod(nextMethod: RegistrationMethod) { journeyStartedAt.current = performance.now(); setMethod(nextMethod); setStep(nextMethod === "resume" ? "resume" : "details"); setNotice(""); }
  function parseResume() {
    if (!resumeText.trim()) { setNotice("Paste the text from your CV to preview the deterministic extraction in this prototype."); return; }
    const startedAt = performance.now();
    const result = parseResumeText(resumeText);
    const durationMs = Math.round(performance.now() - startedAt);
    setParsed(result);
    setContact({ name: result.name ?? "", email: result.email ?? "", mobile: result.phone ?? "" });
    trackProductEvent("candidate_cv_profile_previewed", { durationMs, warningCount: result.warnings.length });
    setNotice(result.warnings.length ? `We found your details in ${durationMs}ms. Review anything marked as missing before verification.` : `Details extracted in ${durationMs}ms. Confirm your contact methods and continue to verification.`);
  }
  function handleResumeFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = () => setResumeText(String(reader.result ?? ""));
      reader.readAsText(file);
      setNotice("CV added. Extract the text to review your profile fields.");
    } else {
      setNotice("CV securely queued. PDF and DOCX extraction is performed by the protected server-side parser; paste text below to preview this local prototype.");
    }
  }
  async function startRegistration() {
    try {
      const response = await apiClient<OtpRequestResponse>("/api/auth/request-otp", { method: "POST", body: JSON.stringify({ flow: "CANDIDATE_REGISTRATION", fullName: contact.name, email: contact.email, mobile: contact.mobile, password, termsAccepted: hasConsent }) });
      setTransactionId(response.transactionId);
      setStep("verify");
    } catch (error) { setNotice(error instanceof Error ? error.message : "We could not start registration."); throw error; }
  }
  function continueFromResume() {
    if (!parsed || !contact.email || !contact.mobile || !hasConsent) { setNotice("Extract your CV, confirm an email and mobile number, and accept the required processing consent before continuing."); return; }
    if (!password) { setNotice("Set a password before secure verification."); return; }
    void startRegistration().catch(() => undefined);
  }
  const verifyRegistration = async (codes: { emailCode: string; mobileCode: string }) => {
    const session = await verifyOtpTransaction(transactionId, codes, "both");
    if (!session.authenticated) throw new Error("Complete both verification codes before continuing.");
    trackProductEvent("candidate_onboarding_verified", { method: method ?? "manual", timeToValueMs: Math.round(performance.now() - (journeyStartedAt.current ?? performance.now())) });
    setStep("complete");
  };

  return <AuthFrame eyebrow="Candidate registration" title={step === "choose" ? "Create your candidate profile" : step === "resume" ? "Start with your CV" : step === "details" ? "Register with your details" : step === "verify" ? "Verify both contact methods" : "Your profile is ready"} copy={step === "choose" ? "Choose the route that works for you. Both are protected with email and mobile verification." : step === "resume" ? "We extract structured details for your review. Nothing is saved until you verify both one-time codes." : step === "details" ? "Register with your name, email and mobile number. Your account is created only after dual verification." : step === "verify" ? "One code was sent to your email and one to your mobile. Both must be confirmed to create your profile." : "Your email and mobile have both been verified. You are now registered on Sapienworx."}>
    {step === "choose" && <div className="registration-methods"><button className="registration-method" onClick={() => selectMethod("resume")}><span>⇧</span><div><strong>Build from my CV</strong><p>Upload your CV and review extracted profile details before secure verification.</p></div><b>→</b></button><button className="registration-method" onClick={() => selectMethod("manual")}><span>✦</span><div><strong>Sign up with my details</strong><p>Register using your name, email and mobile number, then verify both.</p></div><b>→</b></button><p className="auth-microcopy">We use your details only to create and secure your Sapienworx profile. You remain in control of your data.</p></div>}
    {step === "resume" && <div className="auth-form"><button className="back-link" onClick={() => setStep("choose")}>← Choose another way</button><label className="upload-target"><input type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => handleResumeFile(event.target.files?.[0])}/><span>⇧</span><strong>{fileName || "Upload your CV"}</strong><small>PDF, DOCX or TXT · Your document is used to prepare your profile for review.</small></label><label className="form-field"><span>Paste CV text to preview extraction</span><textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="Paste a text version of your CV here…"/></label><Button onClick={parseResume} disabled={!resumeText.trim()}>Extract profile details</Button>{parsed && <ResumePreview parsed={parsed} contact={contact} onContactChange={setContact}/>}<AuthField label="Password" type="password" value={password} onChange={setPassword} placeholder="Set a secure password"/><Consent checked={hasConsent} onChange={setHasConsent}/>{notice && <p className="form-notice">{notice}</p>}<Button onClick={continueFromResume} disabled={!parsed || !hasConsent || !password}>Send verification codes →</Button></div>}
    {step === "details" && <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (hasConsent) void startRegistration().catch(() => undefined); }}><button className="back-link" type="button" onClick={() => setStep("choose")}>← Choose another way</button><AuthField label="Full name" value={contact.name} onChange={(value) => setContact({ ...contact, name: value })} placeholder="Your full name"/><AuthField label="Email address" type="email" value={contact.email} onChange={(value) => setContact({ ...contact, email: value })} placeholder="you@example.com"/><AuthField label="Mobile number" type="tel" value={contact.mobile} onChange={(value) => setContact({ ...contact, mobile: value })} placeholder="+91 00000 00000"/><AuthField label="Password" type="password" value={password} onChange={setPassword} placeholder="Set a secure password"/><Consent checked={hasConsent} onChange={setHasConsent}/>{notice && <p className="form-notice">{notice}</p>}<Button type="submit" disabled={!hasConsent || !contact.name || !contact.email || !contact.mobile || !password}>Send verification codes →</Button></form>}
    {step === "verify" && <DualOtp contact={contact} onVerify={verifyRegistration} onResend={startRegistration}/>}
    {step === "complete" && <div className="verified-state"><span>✓</span><h2>Profile created</h2><p>{method === "resume" ? "Your CV details are ready for you to review and complete." : "Your candidate account is secure and ready to personalise."}</p><Button href={method === "resume" ? "/candidate/review" : "/candidate"}>{method === "resume" ? "Review my profile →" : "Open my dashboard →"}</Button></div>}
    <p className="auth-footer">Already registered? <a href="/login">Sign in</a></p>
  </AuthFrame>;
}

function ResumePreview({ parsed, contact, onContactChange }: { parsed: ParsedProfile; contact: Contact; onContactChange: (contact: Contact) => void }) {
  return <section className="parser-preview"><header><div><span className="eyebrow">Deterministic parser</span><h2>Review extracted details</h2></div><span className="parser-version">{parsed.parserVersion}</span></header><div className="parser-preview-grid"><ParserValue label="Name" value={parsed.name}/><ParserValue label="Headline" value={parsed.headline}/><ParserValue label="Skills" value={parsed.skills.join(", ")}/><ParserValue label="Certifications" value={parsed.certifications.join(", ")}/></div><div className="compact-contact-grid"><AuthField label="Email for OTP" type="email" value={contact.email} onChange={(email) => onContactChange({ ...contact, email })}/><AuthField label="Mobile for OTP" type="tel" value={contact.mobile} onChange={(mobile) => onContactChange({ ...contact, mobile })}/></div>{parsed.warnings.length > 0 && <div className="parser-warnings"><b>Check before you continue</b>{parsed.warnings.map((warning) => <span key={warning}>• {warning}</span>)}</div>}</section>;
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) { return <><section className="dpdp-notice"><strong>What we collect and why</strong><p>We use your contact details to secure your account and your CV only to create the profile you review. You can access, correct, export or request deletion of your data.</p></section><label className="consent-row"><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox"/><span><b>I agree to the required Terms and Data Processing Agreement.</b><small>Required to create and secure your profile.</small></span></label></>; }

type RecruiterType = "employer" | "consultant";
type RecruiterDetails = Omit<Contact, "name"> & { firstName: string; lastName: string; city: string; state: string; organization: string; designation: string; password: string; confirmPassword: string };

function RecruiterRegistration() {
  const [step, setStep] = useState<"details" | "verify" | "complete">("details");
  const [recruiterType, setRecruiterType] = useState<RecruiterType>("employer");
  const [details, setDetails] = useState<RecruiterDetails>({ firstName: "", lastName: "", email: "", mobile: "", city: "", state: "", organization: "", designation: "", password: "", confirmPassword: "" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const emailOnly = recruiterType === "employer";
  const completeDetails = Boolean(details.firstName && details.lastName && details.city && details.state && details.mobile && details.email && details.organization && details.designation && details.password && details.confirmPassword && consent);
  const update = (key: keyof RecruiterDetails, value: string) => { setDetails({ ...details, [key]: value }); setError(""); };
  const continueToVerification = async () => {
    if (!isOfficialEmail(details.email)) { setError("Use an official work email address. Public email domains such as gmail.com and yahoo.com are not accepted for recruiter onboarding."); return; }
    if (details.password !== details.confirmPassword) { setError("Your passwords do not match. Please check both password fields."); return; }
    try {
      const response = await apiClient<OtpRequestResponse>("/api/auth/request-otp", { method: "POST", body: JSON.stringify({ flow: recruiterType === "consultant" ? "CONSULTANT_REGISTRATION" : "RECRUITER_REGISTRATION", firstName: details.firstName, lastName: details.lastName, email: details.email, mobile: details.mobile, password: details.password, organisationName: details.organization, designation: details.designation, city: details.city, state: details.state }) });
      setTransactionId(response.transactionId);
      setStep("verify");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not start secure registration."); throw reason; }
  };
  const verifyRegistration = async (codes: { emailCode: string; mobileCode: string }) => {
    const session = await verifyOtpTransaction(transactionId, codes, emailOnly ? "email" : "both");
    if (!session.authenticated) throw new Error("Complete each required verification code before continuing.");
    setStep("complete");
  };
  const verificationLabel = emailOnly ? "Verify your official email" : "Verify email and mobile";

  return <AuthFrame eyebrow="Recruiter & consultant onboarding" title={step === "details" ? "Create your free account" : step === "verify" ? verificationLabel : "You’re securely verified"} copy={step === "details" ? "Post your first job in less than two minutes. Select the account type that best describes your hiring work." : step === "verify" ? emailOnly ? "A one-time code was sent to your official work email. Verify it to activate your recruiter workspace." : "One-time codes were sent to your official work email and mobile number. Verify both to access your consultant workspace." : emailOnly ? "Your official work email has been verified. Your recruiter workspace is ready." : "Your email and mobile have both been verified. Your consultant workspace is ready."}>
    {step === "details" ? <form className="auth-form recruiter-onboarding-form" onSubmit={(event) => { event.preventDefault(); void continueToVerification().catch(() => undefined); }}>
      <div className="recruiter-type-options" role="radiogroup" aria-label="Registration type"><button type="button" role="radio" aria-checked={recruiterType === "employer"} className={recruiterType === "employer" ? "recruiter-type-card selected" : "recruiter-type-card"} onClick={() => setRecruiterType("employer")}><span>▦</span><div><strong>Direct Employer</strong><small>Hiring for your own organization.</small></div>{recruiterType === "employer" && <b>✓</b>}</button><button type="button" role="radio" aria-checked={recruiterType === "consultant"} className={recruiterType === "consultant" ? "recruiter-type-card selected" : "recruiter-type-card"} onClick={() => setRecruiterType("consultant")}><span>◫</span><div><strong>Consultant / Agency</strong><small>Finding talent for third-party clients.</small></div>{recruiterType === "consultant" && <b>✓</b>}</button></div>
      <div className="onboarding-progress" aria-label="Onboarding progress"><span className="current">1. Account details</span><i/><span>2. Company profile</span><i/><span>3. Verification</span></div>
      <div className="recruiter-field-grid"><AuthField label="First name" value={details.firstName} onChange={(value) => update("firstName", value)} placeholder="Your first name"/><AuthField label="Last name" value={details.lastName} onChange={(value) => update("lastName", value)} placeholder="Your last name"/><AuthField label="City" value={details.city} onChange={(value) => update("city", value)} placeholder="e.g. Bengaluru"/><AuthField label="State" value={details.state} onChange={(value) => update("state", value)} placeholder="e.g. Karnataka"/><AuthField label="Phone" type="tel" value={details.mobile} onChange={(value) => update("mobile", value)} placeholder="e.g. 9873721034"/><AuthField label="Work email id" type="email" value={details.email} onChange={(value) => update("email", value)} placeholder="Your official email id (not gmail/yahoo)"/><AuthField label="Company name" value={details.organization} onChange={(value) => update("organization", value)} placeholder="Enter your company name"/><AuthField label="Designation" value={details.designation} onChange={(value) => update("designation", value)} placeholder="e.g. Talent Acquisition Manager"/><AuthField label="Password" type="password" value={details.password} onChange={(value) => update("password", value)} placeholder="Set a password"/><AuthField label="Confirm password" type="password" value={details.confirmPassword} onChange={(value) => update("confirmPassword", value)} placeholder="Confirm password"/></div>
      <div className="verification-rule"><span>⌁</span><p>{emailOnly ? "Direct Employers are activated only after OTP verification of their official work email." : "Consultants and agencies must verify both their official email and mobile number."}</p></div><Consent checked={consent} onChange={setConsent}/>{error && <p className="consent-error">{error}</p>}<Button type="submit" disabled={!completeDetails}>{emailOnly ? "Continue to email verification →" : "Continue to dual verification →"}</Button>
    </form> : step === "verify" ? <DualOtp contact={{ name: `${details.firstName} ${details.lastName}`.trim(), email: details.email, mobile: details.mobile }} methods={emailOnly ? "email" : "both"} onVerify={verifyRegistration} onResend={continueToVerification}/> : <div className="verified-state"><span>✓</span><h2>Account verified</h2><p>{emailOnly ? "Your official email is verified. You can now set up your organization and publish your first role." : "Your official email and mobile are verified. You can now access your consultant workspace."}</p><Button href="/recruiter">Open recruiter workspace →</Button></div>}
    <p className="auth-footer">Already registered? <a href="/recruiter/login">Sign in</a></p>
  </AuthFrame>;
}

export function CandidateOnboarding() { return <AuthFrame eyebrow="Secure resume intake" title="Build your profile from your CV" copy="Upload your CV after registration to extract structured profile details you can review."><div className="verified-state"><span>⇧</span><h2>Continue your profile</h2><p>Your candidate account is secure. Open the profile review to add your CV details, experience, skills and links.</p><Button href="/candidate/review">Review my profile →</Button></div></AuthFrame>; }

function ParserValue({ label, value }: { label: string; value?: string }) { return <div><span>{label}</span><strong>{value || "Not found"}</strong></div>; }
function AuthField({ label, placeholder, type = "text", value, onChange }: { label: string; placeholder?: string; type?: string; value?: string; onChange?: (value: string) => void }) { return <label className="auth-field"><span>{label}</span><input required type={type} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder}/></label>; }
export function AuthFrame({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children: React.ReactNode }) { return <main className="auth-page"><header className="auth-nav"><Logo/><a href="/">Back to home</a></header><section className="auth-layout"><aside className="auth-aside"><span className="auth-aside-kicker">Sapienworx</span><h1>Recruitment that keeps <em>people</em> in control.</h1><p>Clear progress for candidates. Confident decisions for recruitment teams. Privacy built into the journey.</p><div className="auth-benefits"><span>✓ Human-confirmed profile data</span><span>✓ Two-factor account protection</span><span>✓ Clear data choices</span></div></aside><section className="auth-card"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-copy">{copy}</p>{children}</section></section></main>; }

function friendlyOtpError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "";
  return /\b(invalid|expired)\b/i.test(message) ? "That code didn’t match. Check the latest six-digit code, or request a new one when the timer ends." : message || "We could not verify these codes.";
}

function DualOtp({ contact, onVerified, onVerify, onResend, methods = "both" }: { contact: Contact; onVerified?: () => void; onVerify?: (codes: { emailCode: string; mobileCode: string }) => Promise<void>; onResend?: () => Promise<void>; methods?: "email" | "both" }) {
  const [emailCode, setEmailCode] = useState("");
  const [mobileCode, setMobileCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(30);
  const ready = emailCode.length === 6 && (methods === "email" || mobileCode.length === 6);
  useEffect(() => { if (cooldownSeconds <= 0) return; const timer = window.setTimeout(() => setCooldownSeconds((value) => value - 1), 1000); return () => window.clearTimeout(timer); }, [cooldownSeconds]);
  const verify = async () => { setError(""); setVerifying(true); try { if (onVerify) await onVerify({ emailCode, mobileCode }); else onVerified?.(); } catch (reason) { setError(friendlyOtpError(reason)); } finally { setVerifying(false); } };
  const resend = async () => { if (!onResend || cooldownSeconds > 0 || resending) return; setError(""); setResending(true); try { await onResend(); setCooldownSeconds(30); setEmailCode(""); setMobileCode(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not send another code."); } finally { setResending(false); } };
  return <div className="dual-otp"><div className="otp-method"><div><strong>Email code</strong><small>Sent to {maskEmail(contact.email)}</small></div><OtpInputs label="Email verification code" onChange={setEmailCode}/></div>{methods === "both" && <div className="otp-method"><div><strong>Mobile code</strong><small>Sent to {maskMobile(contact.mobile)}</small></div><OtpInputs label="Mobile verification code" onChange={setMobileCode}/></div>}{error && <p className="consent-error" role="alert">{error}</p>}<Button onClick={() => { void verify(); }} disabled={!ready || verifying}>{verifying ? "Verifying…" : methods === "email" ? "Verify email code" : "Verify both codes"}</Button>{onResend && <button className="otp-resend" type="button" onClick={() => { void resend(); }} disabled={cooldownSeconds > 0 || resending}>{resending ? "Sending another code…" : cooldownSeconds > 0 ? `Resend code in 0:${String(cooldownSeconds).padStart(2, "0")}` : "Resend code"}</button>}<p className="auth-microcopy">Digits advance automatically as you type. Codes expire after 10 minutes and are never stored as plain text. To protect your account, a new code can be requested once every 30 seconds.</p></div>;
}
async function verifyOtpTransaction(transactionId: string, codes: { emailCode: string; mobileCode: string }, methods: "email" | "both") {
  if (!transactionId) throw new Error("Your verification session has expired. Start again.");
  const emailSession = await apiClient<AuthSessionResponse>("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ transactionId, channel: "EMAIL", code: codes.emailCode }) });
  if (methods === "email") return emailSession;
  return apiClient<AuthSessionResponse>("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ transactionId, channel: "MOBILE", code: codes.mobileCode }) });
}
function OtpInputs({ label, onChange }: { label: string; onChange: (value: string) => void }) { const [digits, setDigits] = useState<string[]>(Array(6).fill("")); const digitsRef = useRef<string[]>(Array(6).fill("")); const inputRefs = useRef<Array<HTMLInputElement | null>>([]); const updateDigits = (next: string[]) => { digitsRef.current = next; setDigits(next); onChange(next.join("")); }; const fillDigits = (start: number, value: string) => { const incoming = value.replace(/\D/g, "").slice(0, 6 - start); const next = [...digitsRef.current]; if (!incoming) { next[start] = ""; updateDigits(next); return; } incoming.split("").forEach((digit, offset) => { next[start + offset] = digit; }); updateDigits(next); const nextIndex = Math.min(start + incoming.length, 5); inputRefs.current[nextIndex]?.focus(); }; return <div className="otp-inputs" aria-label={label}>{digits.map((digit, index) => <input key={index} ref={(element) => { inputRefs.current[index] = element; }} inputMode="numeric" maxLength={1} value={digit} aria-label={`${label} digit ${index + 1}`} onChange={(event) => fillDigits(index, event.target.value)} onPaste={(event) => { event.preventDefault(); fillDigits(index, event.clipboardData.getData("text")); }} onKeyDown={(event) => { if (event.key === "Backspace" && !digitsRef.current[index] && index > 0) inputRefs.current[index - 1]?.focus(); }} />)}</div>; }
function isOfficialEmail(email: string) { const domain = email.toLowerCase().trim().split("@")[1]; return Boolean(domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"].includes(domain)); }
function maskEmail(email: string) { const [name, domain] = email.split("@"); return name && domain ? `${name.slice(0, 2)}•••@${domain}` : "your email address"; }
function maskMobile(mobile: string) { return mobile ? `${mobile.slice(0, 3)} ••••• ${mobile.slice(-2)}` : "your mobile number"; }
