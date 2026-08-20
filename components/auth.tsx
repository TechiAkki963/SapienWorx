"use client";

import { useState } from "react";
import { Button, Logo } from "./ui";
import { parseResumeText, type ParsedProfile } from "../lib/parser/deterministic";

type Portal = "candidate" | "recruiter";
type RegistrationMethod = "resume" | "manual";
type Contact = { name: string; email: string; mobile: string };

export function LoginPortal({ defaultPortal = "candidate" }: { defaultPortal?: Portal }) {
  const [portal, setPortal] = useState<Portal>(defaultPortal);
  const [step, setStep] = useState<"credentials" | "verify">("credentials");
  const [contact, setContact] = useState<Contact>({ name: "", email: portal === "candidate" ? "candidate@example.com" : "team@company.com", mobile: "+91 98765 43210" });
  const target = portal === "candidate" ? "/candidate" : "/recruiter";

  return <AuthFrame eyebrow={portal === "candidate" ? "Candidate portal" : "Recruiter workspace"} title={step === "credentials" ? "Welcome back" : "Verify it’s you"} copy={step === "credentials" ? "Use the space built for your next career move." : "Enter both one-time codes before continuing."}>
    <div className="portal-switch" role="tablist" aria-label="Choose a portal"><button className={portal === "candidate" ? "active" : ""} onClick={() => { setPortal("candidate"); setStep("credentials"); }} role="tab" aria-selected={portal === "candidate"}>Candidate</button><button className={portal === "recruiter" ? "active" : ""} onClick={() => { setPortal("recruiter"); setStep("credentials"); }} role="tab" aria-selected={portal === "recruiter"}>Recruiter</button></div>
    {step === "credentials" ? <form className="auth-form" onSubmit={(event) => { event.preventDefault(); setStep("verify"); }}><AuthField label="Email address" type="email" value={contact.email} onChange={(value) => setContact({ ...contact, email: value })} placeholder={portal === "candidate" ? "you@example.com" : "you@company.com"}/><AuthField label="Password" type="password" placeholder="Enter your password"/><div className="auth-row"><label><input type="checkbox"/> Remember this device</label><a href="#forgot">Forgot password?</a></div><Button type="submit">Continue securely →</Button><p className="auth-microcopy">For every sign-in, we confirm both email and mobile ownership.</p></form> : <DualOtp contact={contact} onVerified={() => window.location.assign(target)}/>} 
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

  function selectMethod(nextMethod: RegistrationMethod) { setMethod(nextMethod); setStep(nextMethod === "resume" ? "resume" : "details"); setNotice(""); }
  function parseResume() {
    if (!resumeText.trim()) { setNotice("Paste the text from your CV to preview the deterministic extraction in this prototype."); return; }
    const result = parseResumeText(resumeText);
    setParsed(result);
    setContact({ name: result.name ?? "", email: result.email ?? "", mobile: result.phone ?? "" });
    setNotice(result.warnings.length ? "We found your details. Review anything marked as missing before verification." : "Details extracted. Confirm your contact methods and continue to verification.");
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
  function continueFromResume() {
    if (!parsed || !contact.email || !contact.mobile || !hasConsent) { setNotice("Extract your CV, confirm an email and mobile number, and accept the required processing consent before continuing."); return; }
    setStep("verify");
  }

  return <AuthFrame eyebrow="Candidate registration" title={step === "choose" ? "Create your candidate profile" : step === "resume" ? "Start with your CV" : step === "details" ? "Register with your details" : step === "verify" ? "Verify both contact methods" : "Your profile is ready"} copy={step === "choose" ? "Choose the route that works for you. Both are protected with email and mobile verification." : step === "resume" ? "We extract structured details for your review. Nothing is saved until you verify both one-time codes." : step === "details" ? "Register with your name, email and mobile number. Your account is created only after dual verification." : step === "verify" ? "One code was sent to your email and one to your mobile. Both must be confirmed to create your profile." : "Your email and mobile have both been verified. You are now registered on Sapienworx."}>
    {step === "choose" && <div className="registration-methods"><button className="registration-method" onClick={() => selectMethod("resume")}><span>⇧</span><div><strong>Build from my CV</strong><p>Upload your CV and review extracted profile details before secure verification.</p></div><b>→</b></button><button className="registration-method" onClick={() => selectMethod("manual")}><span>✦</span><div><strong>Sign up with my details</strong><p>Register using your name, email and mobile number, then verify both.</p></div><b>→</b></button><p className="auth-microcopy">We use your details only to create and secure your Sapienworx profile. You remain in control of your data.</p></div>}
    {step === "resume" && <div className="auth-form"><button className="back-link" onClick={() => setStep("choose")}>← Choose another way</button><label className="upload-target"><input type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => handleResumeFile(event.target.files?.[0])}/><span>⇧</span><strong>{fileName || "Upload your CV"}</strong><small>PDF, DOCX or TXT · Your document is used to prepare your profile for review.</small></label><label className="form-field"><span>Paste CV text to preview extraction</span><textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="Paste a text version of your CV here…"/></label><Button onClick={parseResume} disabled={!resumeText.trim()}>Extract profile details</Button>{parsed && <ResumePreview parsed={parsed} contact={contact} onContactChange={setContact}/>}<Consent checked={hasConsent} onChange={setHasConsent}/>{notice && <p className="form-notice">{notice}</p>}<Button onClick={continueFromResume} disabled={!parsed || !hasConsent}>Send verification codes →</Button></div>}
    {step === "details" && <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (hasConsent) setStep("verify"); }}><button className="back-link" type="button" onClick={() => setStep("choose")}>← Choose another way</button><AuthField label="Full name" value={contact.name} onChange={(value) => setContact({ ...contact, name: value })} placeholder="Your full name"/><AuthField label="Email address" type="email" value={contact.email} onChange={(value) => setContact({ ...contact, email: value })} placeholder="you@example.com"/><AuthField label="Mobile number" type="tel" value={contact.mobile} onChange={(value) => setContact({ ...contact, mobile: value })} placeholder="+91 00000 00000"/><Consent checked={hasConsent} onChange={setHasConsent}/><Button type="submit" disabled={!hasConsent || !contact.name || !contact.email || !contact.mobile}>Send verification codes →</Button></form>}
    {step === "verify" && <DualOtp contact={contact} onVerified={() => setStep("complete")}/>} 
    {step === "complete" && <div className="verified-state"><span>✓</span><h2>Profile created</h2><p>{method === "resume" ? "Your CV details are ready for you to review and complete." : "Your candidate account is secure and ready to personalise."}</p><Button href={method === "resume" ? "/candidate/review" : "/candidate"}>{method === "resume" ? "Review my profile →" : "Open my dashboard →"}</Button></div>}
    <p className="auth-footer">Already registered? <a href="/login">Sign in</a></p>
  </AuthFrame>;
}

function ResumePreview({ parsed, contact, onContactChange }: { parsed: ParsedProfile; contact: Contact; onContactChange: (contact: Contact) => void }) {
  return <section className="parser-preview"><header><div><span className="eyebrow">Deterministic parser</span><h2>Review extracted details</h2></div><span className="parser-version">{parsed.parserVersion}</span></header><div className="parser-preview-grid"><ParserValue label="Name" value={parsed.name}/><ParserValue label="Headline" value={parsed.headline}/><ParserValue label="Skills" value={parsed.skills.join(", ")}/><ParserValue label="Certifications" value={parsed.certifications.join(", ")}/></div><div className="compact-contact-grid"><AuthField label="Email for OTP" type="email" value={contact.email} onChange={(email) => onContactChange({ ...contact, email })}/><AuthField label="Mobile for OTP" type="tel" value={contact.mobile} onChange={(mobile) => onContactChange({ ...contact, mobile })}/></div>{parsed.warnings.length > 0 && <div className="parser-warnings"><b>Check before you continue</b>{parsed.warnings.map((warning) => <span key={warning}>• {warning}</span>)}</div>}</section>;
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) { return <><section className="dpdp-notice"><strong>What we collect and why</strong><p>We use your contact details to secure your account and your CV only to create the profile you review. You can access, correct, export or request deletion of your data.</p></section><label className="consent-row"><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox"/><span><b>I agree to the required Terms and Data Processing Agreement.</b><small>Required to create and secure your profile.</small></span></label></>; }

function RecruiterRegistration() {
  const [step, setStep] = useState<"details" | "verify" | "complete">("details");
  const [contact, setContact] = useState<Contact>({ name: "", email: "", mobile: "" });
  const [consent, setConsent] = useState(false);
  return <AuthFrame eyebrow="Recruiter registration" title={step === "details" ? "Start your recruitment workspace" : step === "verify" ? "Verify both contact methods" : "You’re securely verified"} copy={step === "details" ? "Secure your team’s recruitment workspace with clear consent and account controls." : "Two one-time codes protect access to your organisation workspace."}>{step === "details" ? <form className="auth-form" onSubmit={(event) => { event.preventDefault(); setStep("verify"); }}><AuthField label="Full name" value={contact.name} onChange={(name) => setContact({ ...contact, name })}/><AuthField label="Work email" type="email" value={contact.email} onChange={(email) => setContact({ ...contact, email })}/><AuthField label="Mobile number" type="tel" value={contact.mobile} onChange={(mobile) => setContact({ ...contact, mobile })}/><Consent checked={consent} onChange={setConsent}/><Button type="submit" disabled={!contact.name || !contact.email || !contact.mobile || !consent}>Continue to verification →</Button></form> : step === "verify" ? <DualOtp contact={contact} onVerified={() => setStep("complete")}/> : <div className="verified-state"><span>✓</span><h2>Account verified</h2><p>Your recruiter workspace is ready for organisation setup.</p><Button href="/recruiter">Open recruiter workspace →</Button></div>}<p className="auth-footer">Already registered? <a href="/recruiter/login">Sign in</a></p></AuthFrame>;
}

export function CandidateOnboarding() { return <AuthFrame eyebrow="Secure resume intake" title="Build your profile from your CV" copy="Upload your CV after registration to extract structured profile details you can review."><div className="verified-state"><span>⇧</span><h2>Continue your profile</h2><p>Your candidate account is secure. Open the profile review to add your CV details, experience, skills and links.</p><Button href="/candidate/review">Review my profile →</Button></div></AuthFrame>; }

function ParserValue({ label, value }: { label: string; value?: string }) { return <div><span>{label}</span><strong>{value || "Not found"}</strong></div>; }
function AuthField({ label, placeholder, type = "text", value, onChange }: { label: string; placeholder?: string; type?: string; value?: string; onChange?: (value: string) => void }) { return <label className="auth-field"><span>{label}</span><input required type={type} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder}/></label>; }
function AuthFrame({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children: React.ReactNode }) { return <main className="auth-page"><header className="auth-nav"><Logo/><a href="/">Back to home</a></header><section className="auth-layout"><aside className="auth-aside"><span className="auth-aside-kicker">Sapienworx</span><h1>Recruitment that keeps <em>people</em> in control.</h1><p>Clear progress for candidates. Confident decisions for recruitment teams. Privacy built into the journey.</p><div className="auth-benefits"><span>✓ Human-confirmed profile data</span><span>✓ Two-factor account protection</span><span>✓ Clear data choices</span></div></aside><section className="auth-card"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-copy">{copy}</p>{children}</section></section></main>; }

function DualOtp({ contact, onVerified }: { contact: Contact; onVerified: () => void }) {
  const [emailCode, setEmailCode] = useState("");
  const [mobileCode, setMobileCode] = useState("");
  const ready = emailCode.length === 6 && mobileCode.length === 6;
  return <div className="dual-otp"><div className="otp-method"><div><strong>Email code</strong><small>Sent to {maskEmail(contact.email)}</small></div><OtpInputs label="Email verification code" value={emailCode} onChange={setEmailCode}/></div><div className="otp-method"><div><strong>Mobile code</strong><small>Sent to {maskMobile(contact.mobile)}</small></div><OtpInputs label="Mobile verification code" value={mobileCode} onChange={setMobileCode}/></div><Button onClick={onVerified} disabled={!ready}>Verify both codes</Button><p className="auth-microcopy">Enter all six digits in each code. Codes expire after 10 minutes and are never stored as plain text.</p></div>;
}
function OtpInputs({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="otp-inputs" aria-label={label}>{Array.from({ length: 6 }, (_, index) => <input key={index} inputMode="numeric" maxLength={1} value={value[index] ?? ""} aria-label={`${label} digit ${index + 1}`} onChange={(event) => { const digit = event.target.value.replace(/\D/g, "").slice(-1); const next = value.split(""); next[index] = digit; onChange(next.join("").slice(0, 6)); }}/>)}</div>; }
function maskEmail(email: string) { const [name, domain] = email.split("@"); return name && domain ? `${name.slice(0, 2)}•••@${domain}` : "your email address"; }
function maskMobile(mobile: string) { return mobile ? `${mobile.slice(0, 3)} ••••• ${mobile.slice(-2)}` : "your mobile number"; }
