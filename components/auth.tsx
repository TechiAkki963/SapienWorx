"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Logo } from "./ui";
import { parseResumeText, type ParsedProfile } from "../lib/parser/deterministic";
import { apiClient } from "../lib/api-client";
import { trackProductEvent } from "../lib/telemetry";

type Portal = "candidate" | "recruiter";
type RegistrationMethod = "resume" | "manual";
type Contact = { name: string; email: string; mobile: string };
type CandidateIdentity = { firstName: string; lastName: string; email: string; mobile: string };
type CandidateDomain = "TECH" | "NON_TECH";
type CandidateBasics = { headline: string; currentCompany: string; location: string; overallExperienceYears: string; expectedSalaryLakhs: string; noticePeriodDays: string };
type OtpRequestResponse = { transactionId: string; requiredChannels: Array<"EMAIL" | "MOBILE"> };
type AuthSessionResponse = { authenticated: boolean; redirectTo: string | null; remainingChannels: Array<"EMAIL" | "MOBILE"> };

const interestedDomainOptions = ["Technology", "IT Services", "Manufacturing & Production", "Healthcare & Life Sciences", "Infrastructure, Transport & Real Estate", "BFSI", "BPM", "Consumer, Retail & Hospitality", "Media, Entertainment & Telecom", "Education"];

export function LoginPortal({ defaultPortal = "candidate", jobId }: { defaultPortal?: Portal; jobId?: string }) {
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
    if (portal === "candidate" && jobId) {
      try {
        await apiClient(`/api/candidate/jobs/${encodeURIComponent(jobId)}/applications`, { method: "POST", body: JSON.stringify({ coverLetter: null }) });
      } catch (error) {
        if (!(error instanceof Error) || !/already applied/i.test(error.message)) throw error;
      }
      window.location.assign(`/candidate/jobs?sharedJob=${encodeURIComponent(jobId)}`);
      return;
    }
    window.location.assign(session.redirectTo);
  };

  return <AuthFrame eyebrow={portal === "candidate" ? "Candidate portal" : "Recruiter workspace"} title={step === "credentials" ? "Welcome back" : "Verify it’s you"} copy={step === "credentials" ? portal === "candidate" ? "Enter your email and password, then confirm both verified contact methods." : "Use the space built for your recruitment work." : "Enter both one-time codes before continuing."}>
    <div className="portal-switch" role="tablist" aria-label="Choose a portal"><button className={portal === "candidate" ? "active" : ""} onClick={() => { setPortal("candidate"); setStep("credentials"); setNotice(""); }} role="tab" aria-selected={portal === "candidate"}>Candidate</button><button className={portal === "recruiter" ? "active" : ""} onClick={() => { setPortal("recruiter"); setStep("credentials"); setNotice(""); }} role="tab" aria-selected={portal === "recruiter"}>Recruiter</button></div>
    {step === "credentials" ? <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void requestSignIn().catch(() => undefined); }}><AuthField label="Email address" type="email" value={contact.email} onChange={(value) => setContact({ ...contact, email: value })} placeholder={portal === "candidate" ? "you@example.com" : "you@company.com"}/><AuthField label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter your password"/>{portal === "recruiter" && <div className="auth-row"><label><input type="checkbox"/> Remember this device</label><a href="#forgot">Forgot password?</a></div>}{notice && <p className="consent-error" role="alert">{notice}</p>}<Button type="submit" disabled={!contact.email || !password}>Continue securely →</Button><p className="auth-microcopy">Candidate sign-in always confirms both email and mobile ownership.</p></form> : <DualOtp contact={contact} methods={portal === "candidate" ? "both" : "email"} onVerify={verifySignIn} onResend={requestSignIn}/>}
    <p className="auth-footer">New to Sapienworx? <a href={portal === "candidate" ? `/register${jobId ? `?job=${encodeURIComponent(jobId)}` : ""}` : "/recruiter/register"}>Create an account</a></p>
  </AuthFrame>;
}

export function RegistrationPortal({ portal = "candidate", jobId }: { portal?: Portal; jobId?: string }) {
  if (portal === "recruiter") return <RecruiterRegistration />;
  return <CandidateRegistration jobId={jobId} />;
}

function LegacyCandidateRegistration() {
  const [method, setMethod] = useState<RegistrationMethod | null>(null);
  const [step, setStep] = useState<"choose" | "resume" | "details" | "verify" | "complete">("choose");
  const [contact, setContact] = useState<Contact>({ name: "", email: "", mobile: "" });
  const [basics, setBasics] = useState<CandidateBasics>({ headline: "", currentCompany: "", location: "", overallExperienceYears: "", expectedSalaryLakhs: "", noticePeriodDays: "" });
  const [parsed, setParsed] = useState<ParsedProfile | null>(null);
  const [fileName, setFileName] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [hasConsent, setHasConsent] = useState(false);
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [cvUploadMessage, setCvUploadMessage] = useState("");
  const journeyStartedAt = useRef<number | null>(null);

  function selectMethod(nextMethod: RegistrationMethod) { journeyStartedAt.current = performance.now(); setMethod(nextMethod); setStep(nextMethod === "resume" ? "resume" : "details"); setNotice(""); }
  function parseResume() {
    if (!resumeText.trim()) { setNotice("Paste the text from your CV to preview the deterministic extraction in this prototype."); return; }
    const startedAt = performance.now();
    const result = parseResumeText(resumeText);
    const durationMs = Math.round(performance.now() - startedAt);
    setParsed(result);
    setContact({ name: result.name ?? "", email: result.email ?? "", mobile: result.phone ?? "" });
    setBasics((current) => ({ ...current, headline: result.headline ?? current.headline }));
    trackProductEvent("candidate_cv_profile_previewed", { durationMs, warningCount: result.warnings.length });
    setNotice(result.warnings.length ? `We found your details in ${durationMs}ms. Review anything marked as missing before verification.` : `Details extracted in ${durationMs}ms. Confirm your contact methods and continue to verification.`);
  }
  function handleResumeFile(file?: File) {
    if (!file) return;
    setResumeFile(file);
    setFileName(file.name);
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = () => setResumeText(String(reader.result ?? ""));
      reader.readAsText(file);
      setNotice("CV added. Review the extracted details, then we will upload the original file after both contact methods are verified.");
    } else {
      setNotice("Your CV is ready. It stays on this device until both contact methods are verified, then we securely upload it for extraction. You do not need to paste its text.");
    }
  }
  async function startRegistration() {
    try {
      const response = await apiClient<OtpRequestResponse>("/api/auth/request-otp", { method: "POST", body: JSON.stringify({
        flow: "CANDIDATE_REGISTRATION", fullName: contact.name, email: contact.email, mobile: contact.mobile, password, termsAccepted: hasConsent,
        headline: basics.headline, currentCompany: basics.currentCompany || null, location: basics.location,
        overallExperienceYears: Number(basics.overallExperienceYears), expectedSalaryLakhs: basics.expectedSalaryLakhs ? Number(basics.expectedSalaryLakhs) : null,
        noticePeriodDays: Number(basics.noticePeriodDays),
      }) });
      setTransactionId(response.transactionId);
      setStep("verify");
    } catch (error) { setNotice(error instanceof Error ? error.message : "We could not start registration."); throw error; }
  }
  function continueFromResume() {
    if (!resumeFile || !contact.name || !contact.email || !contact.mobile || !basics.headline || !basics.location || !basics.overallExperienceYears || !basics.noticePeriodDays || !hasConsent) { setNotice("Choose a CV, confirm your identity and career essentials, then accept the required processing consent before continuing."); return; }
    if (!password) { setNotice("Set a password before secure verification."); return; }
    void startRegistration().catch(() => undefined);
  }
  const verifyRegistration = async (codes: { emailCode: string; mobileCode: string }) => {
    const session = await verifyOtpTransaction(transactionId, codes, "both");
    if (!session.authenticated) throw new Error("Complete both verification codes before continuing.");
    trackProductEvent("candidate_onboarding_verified", { method: method ?? "manual", timeToValueMs: Math.round(performance.now() - (journeyStartedAt.current ?? performance.now())) });
    if (resumeFile) {
      try {
        const body = new FormData();
        body.set("file", resumeFile);
        await apiClient<{ requestId: string; status: string }>("/api/candidate/cv", { method: "POST", body });
        setCvUploadMessage(`${fileName || "Your CV"} is uploaded and being extracted. Review the suggested details in your profile.`);
      } catch (error) {
        setCvUploadMessage(error instanceof Error ? `Your account is ready, but we could not upload the CV: ${error.message}` : "Your account is ready, but we could not upload the CV. Try again from your profile.");
      }
    }
    setStep("complete");
  };

  return <AuthFrame eyebrow="Candidate registration" title={step === "choose" ? "Create your candidate profile" : step === "resume" ? "Start with your CV" : step === "details" ? "Set up your candidate profile" : step === "verify" ? "Verify both contact methods" : "Your profile is ready"} copy={step === "choose" ? "Choose the route that works for you. Both are protected with email and mobile verification." : step === "resume" ? "We extract structured details for your review. Nothing is saved until you verify both one-time codes." : step === "details" ? "Start with your identity and five career essentials. You can add the rest later." : step === "verify" ? "One code was sent to your email and one to your mobile. Both must be confirmed to create your profile." : "Your email, mobile and career essentials are saved. Continue to add your CV and the rest of your experience."}>
    {step === "choose" && <div className="registration-methods"><button className="registration-method" onClick={() => selectMethod("resume")}><span>⇧</span><div><strong>Build from my CV</strong><p>Upload your CV and confirm the extracted contact and career details before secure verification.</p></div><b>→</b></button><button className="registration-method" onClick={() => selectMethod("manual")}><span>✦</span><div><strong>Sign up with my details</strong><p>Add your identity, designation, location, experience and notice period in one short step.</p></div><b>→</b></button><p className="auth-microcopy">We use your details only to create and secure your Sapienworx profile. You remain in control of your data.</p></div>}
    {step === "resume" && <div className="auth-form"><button className="back-link" onClick={() => setStep("choose")}>← Choose another way</button><label className="upload-target"><input type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => handleResumeFile(event.target.files?.[0])}/><span>⇧</span><strong>{fileName || "Upload your CV"}</strong><small>PDF, DOCX or TXT · The file stays on this device until your email and mobile are verified.</small></label><label className="form-field"><span>Paste CV text to preview extraction (optional)</span><textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="Paste a text version of your CV to preview extraction now…"/></label><Button onClick={parseResume} disabled={!resumeText.trim()}>Preview extracted details</Button>{parsed && <ResumePreview parsed={parsed} contact={contact} onContactChange={setContact}/>} {resumeFile && !parsed && <CandidateIdentityFields contact={contact} onChange={setContact}/>} {resumeFile && <CandidateEssentials basics={basics} onChange={setBasics}/>}<AuthField label="Password" type="password" value={password} onChange={setPassword} placeholder="Set a secure password"/><Consent checked={hasConsent} onChange={setHasConsent}/>{notice && <p className="form-notice">{notice}</p>}<Button onClick={continueFromResume} disabled={!resumeFile || !hasConsent || !password || !contact.name || !contact.email || !contact.mobile || !basics.headline || !basics.location || !basics.overallExperienceYears || !basics.noticePeriodDays}>Send verification codes →</Button></div>}
    {step === "details" && <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (hasConsent) void startRegistration().catch(() => undefined); }}><button className="back-link" type="button" onClick={() => setStep("choose")}>← Choose another way</button><div className="candidate-signup-stage"><span>1</span><div><strong>Identity and verified contact</strong><small>This is displayed as your secure account identity.</small></div></div><div className="candidate-onboarding-grid"><AuthField label="Full name" value={contact.name} onChange={(value) => setContact({ ...contact, name: value })} placeholder="Your full name"/><AuthField label="Email address" type="email" value={contact.email} onChange={(value) => setContact({ ...contact, email: value })} placeholder="you@example.com"/><AuthField label="Mobile number" type="tel" value={contact.mobile} onChange={(value) => setContact({ ...contact, mobile: value })} placeholder="+91 00000 00000"/></div><div className="candidate-signup-stage"><span>2</span><div><strong>Career essentials</strong><small>These make your first profile card useful immediately. You can complete the rest later.</small></div></div><CandidateEssentials basics={basics} onChange={setBasics}/><AuthField label="Password" type="password" value={password} onChange={setPassword} placeholder="Set a secure password"/><Consent checked={hasConsent} onChange={setHasConsent}/>{notice && <p className="form-notice">{notice}</p>}<Button type="submit" disabled={!hasConsent || !contact.name || !contact.email || !contact.mobile || !password || !basics.headline || !basics.location || !basics.overallExperienceYears || !basics.noticePeriodDays}>Send verification codes →</Button></form>}
    {step === "verify" && <DualOtp contact={contact} onVerify={verifyRegistration} onResend={startRegistration}/>}
    {step === "complete" && <div className="verified-state"><span>✓</span><h2>Profile created</h2><p>{method === "resume" ? cvUploadMessage || "Your CV information and career essentials are ready for review and completion." : "Your account is secure and your profile now has the essentials recruiters need."}</p><Button href="/candidate/profile">Continue to my profile →</Button></div>}
    <p className="auth-footer">Already registered? <a href="/login">Sign in</a></p>
  </AuthFrame>;
}

function ResumePreview({ parsed, contact, onContactChange }: { parsed: ParsedProfile; contact: Contact; onContactChange: (contact: Contact) => void }) {
  return <section className="parser-preview"><header><div><span className="eyebrow">Deterministic parser</span><h2>Review extracted details</h2></div><span className="parser-version">{parsed.parserVersion}</span></header><div className="parser-preview-grid"><ParserValue label="Name" value={parsed.name}/><ParserValue label="Headline" value={parsed.headline}/><ParserValue label="Skills" value={parsed.skills.join(", ")}/><ParserValue label="Certifications" value={parsed.certifications.join(", ")}/></div><div className="compact-contact-grid"><AuthField label="Full name" value={contact.name} onChange={(name) => onContactChange({ ...contact, name })}/><AuthField label="Email for OTP" type="email" value={contact.email} onChange={(email) => onContactChange({ ...contact, email })}/><AuthField label="Mobile for OTP" type="tel" value={contact.mobile} onChange={(mobile) => onContactChange({ ...contact, mobile })}/></div>{parsed.warnings.length > 0 && <div className="parser-warnings"><b>Check before you continue</b>{parsed.warnings.map((warning) => <span key={warning}>• {warning}</span>)}</div>}</section>;
}

function CandidateIdentityFields({ contact, onChange }: { contact: Contact; onChange: (contact: Contact) => void }) {
  return <section className="candidate-resume-identity"><span className="eyebrow">Before verification</span><h2>Confirm your identity</h2><p>We will use these details to create your secure candidate account before uploading the CV.</p><div className="candidate-onboarding-grid"><AuthField label="Full name" value={contact.name} onChange={(name) => onChange({ ...contact, name })} placeholder="Your full name"/><AuthField label="Email address" type="email" value={contact.email} onChange={(email) => onChange({ ...contact, email })} placeholder="you@example.com"/><AuthField label="Mobile number" type="tel" value={contact.mobile} onChange={(mobile) => onChange({ ...contact, mobile })} placeholder="+91 00000 00000"/></div></section>;
}

function CandidateEssentials({ basics, onChange }: { basics: CandidateBasics; onChange: (basics: CandidateBasics) => void }) {
  const update = (key: keyof CandidateBasics, value: string) => onChange({ ...basics, [key]: value });
  return <div className="candidate-onboarding-grid candidate-career-grid">
    <AuthField label="Current designation" value={basics.headline} onChange={(value) => update("headline", value)} placeholder="e.g. Senior Backend Engineer"/>
    <AuthField label="Current company (optional)" required={false} value={basics.currentCompany} onChange={(value) => update("currentCompany", value)} placeholder="e.g. Nexora Cloud"/>
    <AuthField label="Current location" value={basics.location} onChange={(value) => update("location", value)} placeholder="e.g. Bengaluru"/>
    <AuthField label="Total experience (years)" type="number" value={basics.overallExperienceYears} onChange={(value) => update("overallExperienceYears", value)} placeholder="e.g. 4"/>
    <AuthField label="Current / expected salary (INR lacs, optional)" required={false} type="number" value={basics.expectedSalaryLakhs} onChange={(value) => update("expectedSalaryLakhs", value)} placeholder="e.g. 18"/>
    <label className="auth-field"><span>Notice period</span><select required value={basics.noticePeriodDays} onChange={(event) => update("noticePeriodDays", event.target.value)}><option value="">Select notice period</option><option value="0">Available immediately</option><option value="15">15 days</option><option value="30">30 days</option><option value="45">45 days</option><option value="60">60 days</option><option value="90">90 days</option><option value="120">120 days</option></select></label>
  </div>;
}

function CandidateRegistration({ jobId }: { jobId?: string }) {
  const [step, setStep] = useState<"details" | "verify" | "profile">("details");
  const [identity, setIdentity] = useState<CandidateIdentity>({ firstName: "", lastName: "", email: "", mobile: "" });
  const [domainCategory, setDomainCategory] = useState<CandidateDomain | "">("");
  const [interestedDomains, setInterestedDomains] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");
  const journeyStartedAt = useRef<number | null>(performance.now());
  const contact = { name: `${identity.firstName} ${identity.lastName}`.trim(), email: identity.email, mobile: identity.mobile };
  const canRequestOtp = Boolean(identity.firstName.trim() && identity.lastName.trim() && identity.email.trim() && identity.mobile.trim() && domainCategory && interestedDomains.length && password.length >= 8 && password === confirmPassword);

  const updateIdentity = (key: keyof CandidateIdentity, value: string) => { setIdentity((current) => ({ ...current, [key]: value })); setNotice(""); };
  const toggleInterest = (value: string) => {
    setInterestedDomains((current) => {
      if (value === "All") return current.length === interestedDomainOptions.length ? [] : [...interestedDomainOptions];
      return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    });
  };
  async function startRegistration() {
    if (password !== confirmPassword) { setNotice("Your passwords do not match. Please check both password fields."); return; }
    if (!canRequestOtp) { setNotice("Add your contact details, choose Tech or Non-tech, select an interested domain, and set an eight-character password before verification."); return; }
    try {
      const response = await apiClient<OtpRequestResponse>("/api/auth/request-otp", { method: "POST", body: JSON.stringify({
        flow: "CANDIDATE_REGISTRATION", firstName: identity.firstName, lastName: identity.lastName, email: identity.email, mobile: identity.mobile,
        domainCategory, interestedDomains, password, termsAccepted: true,
      }) });
      setTransactionId(response.transactionId);
      setStep("verify");
    } catch (error) { setNotice(error instanceof Error ? error.message : "We could not start registration."); throw error; }
  }
  const verifyRegistration = async (codes: { emailCode: string; mobileCode: string }) => {
    const session = await verifyOtpTransaction(transactionId, codes, "both");
    if (!session.authenticated) throw new Error("Complete both verification codes before continuing.");
    trackProductEvent("candidate_onboarding_verified", { primaryDomain: domainCategory, selectedDomainCount: interestedDomains.length, timeToValueMs: Math.round(performance.now() - (journeyStartedAt.current ?? performance.now())) });
    if (jobId) {
      try {
        await apiClient(`/api/candidate/jobs/${encodeURIComponent(jobId)}/applications`, { method: "POST", body: JSON.stringify({ coverLetter: null }) });
        setApplicationMessage("Your application from this shared job link is now in the posting recruiter’s pipeline. You can complete your profile next.");
      } catch (error) {
        setApplicationMessage(error instanceof Error && /already applied/i.test(error.message)
          ? "You had already applied to this shared role. You can complete your profile next."
          : "Your account is verified. Complete your profile, then apply to this role from the Jobs page.");
      }
    }
    setStep("profile");
  };

  return <AuthFrame eyebrow="Candidate registration" title={step === "details" ? jobId ? "Create an account to apply" : "Create your candidate account" : step === "verify" ? "Verify both contact methods" : "Create your profile your way"} copy={step === "details" ? jobId ? "Verify your email and mobile to apply securely through the recruiter who posted this role." : "Start with only your name and verified contact details. Choose the work direction and domains you are interested in before we send codes." : step === "verify" ? "One code was sent to your email and one to your mobile. Both must be confirmed to create your account." : "Your account is verified. Use CV parsing to create a first draft, or add every detail manually."}>
    {step === "details" && <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void startRegistration().catch(() => undefined); }}>
      <div className="candidate-signup-stage"><span>1</span><div><strong>Identity and verified contact</strong><small>We only ask for the details needed to securely create your account.</small></div></div>
      <div className="candidate-onboarding-grid"><AuthField label="First name" value={identity.firstName} onChange={(value) => updateIdentity("firstName", value)} placeholder="Your first name"/><AuthField label="Last name" value={identity.lastName} onChange={(value) => updateIdentity("lastName", value)} placeholder="Your last name"/><AuthField label="Email address" type="email" value={identity.email} onChange={(value) => updateIdentity("email", value)} placeholder="you@example.com"/><AuthField label="Mobile number" type="tel" value={identity.mobile} onChange={(value) => updateIdentity("mobile", value)} placeholder="+91 00000 00000"/><AuthField label="Create password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters"/><AuthField label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter your password"/></div>
      <div className="candidate-signup-stage"><span>2</span><div><strong>Choose your direction</strong><small>Confirm whether you are pursuing Technology / IT or Non-technology opportunities before verification.</small></div></div>
      <div className="candidate-domain-options" role="radiogroup" aria-label="Primary candidate domain"><button type="button" role="radio" aria-checked={domainCategory === "TECH"} className={domainCategory === "TECH" ? "selected" : ""} onClick={() => setDomainCategory("TECH")}><strong>Technology / IT</strong><small>Engineering, data, product and technical roles</small></button><button type="button" role="radio" aria-checked={domainCategory === "NON_TECH"} className={domainCategory === "NON_TECH" ? "selected" : ""} onClick={() => setDomainCategory("NON_TECH")}><strong>Non-technology</strong><small>Business, operations, creative and service roles</small></button></div>
      <fieldset className="candidate-interest-picker"><legend>Interested domains</legend><p>Select one or more domains. You can change these later from your profile.</p><div>{["All", ...interestedDomainOptions].map((domain) => <button type="button" key={domain} role="checkbox" aria-checked={domain === "All" ? interestedDomains.length === interestedDomainOptions.length : interestedDomains.includes(domain)} className={(domain === "All" ? interestedDomains.length === interestedDomainOptions.length : interestedDomains.includes(domain)) ? "selected" : ""} onClick={() => toggleInterest(domain)}>{domain}</button>)}</div></fieldset>
      <p className="auth-microcopy">By sending verification codes, you agree to the required Terms and Data Processing Agreement. Profile details stay private until you choose to create and share them.</p>{notice && <p className="form-notice" role="alert">{notice}</p>}<Button type="submit" disabled={!canRequestOtp}>Send verification codes →</Button>
    </form>}
    {step === "verify" && <DualOtp contact={contact} onVerify={verifyRegistration} onResend={startRegistration}/>}
    {step === "profile" && <ProfileCreationOptions applicationMessage={applicationMessage}/>}
    <p className="auth-footer">Already registered? <a href={`/login${jobId ? `?job=${encodeURIComponent(jobId)}` : ""}`}>Sign in</a></p>
  </AuthFrame>;
}

function ProfileCreationOptions({ applicationMessage = "" }: { applicationMessage?: string }) {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadCv = async () => {
    if (!resumeFile) return;
    setError(""); setMessage(""); setUploading(true);
    try {
      const body = new FormData();
      body.set("file", resumeFile);
      await apiClient<{ requestId: string; status: string }>("/api/candidate/cv", { method: "POST", body });
      trackProductEvent("candidate_cv_upload_requested", { extension: resumeFile.name.split(".").pop()?.toLowerCase() ?? "unknown" });
      setMessage(`${resumeFile.name} is uploaded and being extracted. Review the suggested details in your profile.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not upload your CV. Try again or create your profile manually."); }
    finally { setUploading(false); }
  };
  return <div className="profile-creation-options">{applicationMessage && <p className="form-notice" role="status">{applicationMessage}</p>}<section className="profile-creation-option"><span>⇧</span><div><h2>Build from your CV</h2><p>Upload a PDF, DOCX or TXT file. Sapienworx will extract a private draft for you to review and edit.</p></div><label className="upload-target"><input aria-label="Upload CV for parsing" type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => { setResumeFile(event.target.files?.[0] ?? null); setMessage(""); setError(""); }}/><strong>{resumeFile?.name || "Choose your CV"}</strong><small>PDF, DOCX or TXT · uploaded only to your verified account</small></label>{resumeFile && <Button onClick={uploadCv} disabled={uploading}>{uploading ? "Uploading CV…" : "Upload and parse CV →"}</Button>}{message && <p className="form-notice">{message}</p>}{error && <p className="consent-error" role="alert">{error}</p>}{message && <Button href="/candidate/profile">Review parsed profile →</Button>}</section><section className="profile-creation-option"><span>✦</span><div><h2>Create it manually</h2><p>Add your experience, education, skills, projects and personal preferences one section at a time.</p></div><Button href="/candidate/profile">Build profile manually →</Button></section></div>;
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

export function CandidateOnboarding() { return <AuthFrame eyebrow="Candidate profile setup" title="Finish your profile your way" copy="Your email and mobile are verified. Start with CV parsing or add your profile information manually."><ProfileCreationOptions/></AuthFrame>; }

function ParserValue({ label, value }: { label: string; value?: string }) { return <div><span>{label}</span><strong>{value || "Not found"}</strong></div>; }
function AuthField({ label, placeholder, type = "text", value, onChange, required = true }: { label: string; placeholder?: string; type?: string; value?: string; onChange?: (value: string) => void; required?: boolean }) { return <label className="auth-field"><span>{label}</span><input required={required} type={type} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder}/></label>; }
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
