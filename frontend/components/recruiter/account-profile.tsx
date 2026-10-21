"use client";

import Link from "next/link";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import type {SessionUser} from "@/lib/auth-server";
import type {RecruiterProfile} from "@/lib/recruiter-profile";
import {APIRequestError,apiRequest} from "@/lib/api";
import {DashboardProfileCard} from "@/components/ui/dashboard-profile-card";
import {RecruiterModal,RecruiterModalClose,recruiterInput,recruiterPrimary,recruiterSecondary} from "./workspace-ui";

function Detail({label,children,className=""}:{label:string;children:React.ReactNode;className?:string}) {
  return <div className={`min-w-0 ${className}`}><dt className="text-xs font-medium text-ink-muted">{label}</dt><dd className="mt-1 break-words text-sm leading-6 text-ink">{children||<span className="text-ink-muted">Not added</span>}</dd></div>;
}

export function RecruiterAccountProfile({session,company,activeJobs}:{session:SessionUser;company:string;activeJobs:number}) {
  const router=useRouter();
  const [open,setOpen]=useState(false),[profile,setProfile]=useState<RecruiterProfile|null>(null);
  const [draft,setDraft]=useState<RecruiterProfile|null>(null),[expertise,setExpertise]=useState("");
  const [loading,setLoading]=useState(false),[error,setError]=useState(""),[editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false),[photoBusy,setPhotoBusy]=useState(false),[status,setStatus]=useState("");
  const [resetKey,setResetKey]=useState(0),[retry,setRetry]=useState(0),[conflict,setConflict]=useState(false);
  const nameInput=useRef<HTMLInputElement>(null),errorBox=useRef<HTMLDivElement>(null),editTrigger=useRef<HTMLButtonElement>(null);
  const busy=saving||photoBusy;

  useEffect(()=>{
    const show=()=>setOpen(true);window.addEventListener("sapienworx:recruiter-profile",show);
    return()=>window.removeEventListener("sapienworx:recruiter-profile",show);
  },[]);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();setLoading(true);setError("");setStatus("");setEditing(false);setConflict(false);setProfile(null);
    apiRequest<RecruiterProfile>("/api/v1/recruiter/profile",{signal:controller.signal}).then(result=>{
      if(!controller.signal.aborted){setProfile(result);setDraft(result);setExpertise(result.expertise.join(", "));}
    }).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Could not load your profile.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[open,retry]);
  useEffect(()=>{if(editing)nameInput.current?.focus();},[editing]);

  function edit() {if(!profile)return;setDraft({...profile});setExpertise(profile.expertise.join(", "));setError("");setStatus("");setConflict(false);setResetKey(key=>key+1);setEditing(true);}
  function cancelEdit() {setEditing(false);setDraft(profile);setError("");setConflict(false);setResetKey(key=>key+1);requestAnimationFrame(()=>editTrigger.current?.focus());}
  async function save(event:FormEvent) {
    event.preventDefault();if(!draft||!profile||busy||conflict)return;
    const areas=expertise.split(",").map(value=>value.trim()).filter(Boolean);
    if(areas.length>12||areas.some(value=>Array.from(value).length>40)){setError("Add up to 12 expertise areas, with up to 40 characters each.");requestAnimationFrame(()=>errorBox.current?.focus());return;}
    if(!draft.full_name.trim()){setError("Enter your full name.");nameInput.current?.focus();return;}
    setSaving(true);setError("");
    try {
      const result=await apiRequest<RecruiterProfile>("/api/v1/recruiter/profile",{method:"PATCH",body:JSON.stringify({full_name:draft.full_name.trim(),designation:draft.designation.trim(),work_phone:draft.work_phone.trim(),location:draft.location.trim(),expertise:areas,bio:draft.bio.trim(),expected_updated_at:profile.updated_at})});
      setProfile(result);setDraft(result);setEditing(false);setResetKey(key=>key+1);setStatus("Profile details updated.");requestAnimationFrame(()=>editTrigger.current?.focus());router.refresh();
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Could not save your profile. Your changes are still here.");
      setConflict(cause instanceof APIRequestError&&cause.status===409);
      requestAnimationFrame(()=>errorBox.current?.focus());
    } finally {setSaving(false);}
  }
  const name=profile?.full_name||[session.first_name,session.last_name].filter(Boolean).join(" ");
  const nameParts=name.split(/\s+/);

  return <>
    <button type="button" onClick={()=>setOpen(true)} className="mt-1 flex min-h-11 w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-ink-muted hover:bg-slate-50 hover:text-ink">My profile & photo</button>
    <Link href="/recruiter/settings" onClick={event=>event.currentTarget.closest("details")?.removeAttribute("open")} className="mt-1 flex min-h-11 items-center rounded-lg px-2.5 py-2 text-sm font-semibold text-ink-muted hover:bg-slate-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo">Settings</Link>
    <RecruiterModal open={open} onClose={()=>setOpen(false)} title="Your recruiter profile" size="medium" initialFocus="[data-modal-close]" busy={busy} protectChanges={editing} resetKey={resetKey} footer={editing?<><button type="button" disabled={busy} onClick={cancelEdit} className={recruiterSecondary}>Cancel</button><button type="submit" form="recruiter-profile-form" disabled={busy||conflict} className={recruiterPrimary}>{saving?"Saving…":"Save changes"}</button></>:<RecruiterModalClose disabled={busy}>Close</RecruiterModalClose>}>
      {loading?<p role="status" className="py-10 text-center text-sm text-ink-muted">Loading your profile…</p>:!profile?<div role="alert" className="py-6"><p className="text-sm text-ink">{error||"Your profile is unavailable."}</p><button type="button" onClick={()=>setRetry(value=>value+1)} className={`${recruiterSecondary} mt-4`}>Try again</button></div>:<>
        <section aria-label="Recruiter identity" className="flex min-w-0 flex-col items-center gap-3 border-b border-line pb-5 sm:flex-row sm:items-start sm:gap-5">
          <DashboardProfileCard firstName={nameParts[0]||""} lastName={nameParts.slice(1).join(" ")} headline="" imageUrl={session.profile_image_url} statLabel="" statValue="" avatarOnly onBusyChange={setPhotoBusy}/>
          <div className="min-w-0 flex-1 pt-1 text-center sm:text-left">
            <h3 className="break-words text-xl font-semibold leading-7 tracking-tight text-navy">{name}</h3>
            <p className="mt-1 break-words text-sm font-medium text-ink">{profile.designation||"Recruiter"}</p>
            <p className="mt-1 break-words text-sm text-ink-muted">{profile.company_name||company}</p>
            {profile.location&&<p className="mt-2 break-words text-xs text-ink-muted">{profile.location}</p>}
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-soft px-3 py-1 text-xs font-medium text-indigo">Active roles <strong>{activeJobs.toLocaleString()}</strong></p>
          </div>
        </section>
        <p className="mt-3 text-xs leading-5 text-ink-muted">Your account photo is shared across your SapienWorx workspaces.</p>
        {status&&<p role="status" className="mt-4 text-sm font-medium text-indigo">{status}</p>}
        <div className="mb-4 mt-5 flex items-center justify-between gap-3"><h3 className="font-semibold text-navy">Profile details</h3>{!editing&&<button ref={editTrigger} type="button" disabled={busy} onClick={edit} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-indigo hover:bg-indigo-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo">Edit details</button>}</div>
        {editing&&draft?<form id="recruiter-profile-form" onSubmit={save} className="grid gap-4">
          {error&&<div ref={errorBox} role="alert" tabIndex={-1} className="rounded-lg border border-line bg-indigo-soft/30 p-3 text-sm leading-6 text-ink outline-none">{error}{conflict&&<p className="mt-2 text-xs">Copy any changes you want to keep, then cancel and reopen the profile to load the latest details.</p>}</div>}
          <fieldset disabled={busy} className="grid min-w-0 gap-4 disabled:opacity-70">
            <label className="grid gap-1.5 text-sm font-medium text-ink">Full name<input ref={nameInput} name="full_name" autoComplete="name" required maxLength={160} value={draft.full_name} onChange={event=>setDraft({...draft,full_name:event.target.value})} className={recruiterInput}/></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-ink">Designation<input name="designation" autoComplete="organization-title" maxLength={160} value={draft.designation} onChange={event=>setDraft({...draft,designation:event.target.value})} className={recruiterInput}/></label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">Work phone<input name="work_phone" type="tel" autoComplete="tel" placeholder="+919876543210" maxLength={20} pattern="\+[1-9][0-9]{7,14}" value={draft.work_phone} onChange={event=>setDraft({...draft,work_phone:event.target.value})} aria-describedby="recruiter-work-phone-help" className={recruiterInput}/></label>
            </div>
            <p id="recruiter-work-phone-help" className="-mt-2 text-xs leading-5 text-ink-muted">Optional work contact, in international format. This does not change your verified sign-in number.</p>
            <label className="grid gap-1.5 text-sm font-medium text-ink">Location<input name="location" autoComplete="address-level2" maxLength={160} placeholder="City, country" value={draft.location} onChange={event=>setDraft({...draft,location:event.target.value})} className={recruiterInput}/></label>
            <div className="grid gap-1.5"><label htmlFor="recruiter-expertise" className="text-sm font-medium text-ink">Areas of expertise</label><input id="recruiter-expertise" name="expertise" value={expertise} maxLength={600} onChange={event=>setExpertise(event.target.value)} aria-describedby="recruiter-expertise-help" className={recruiterInput}/><p id="recruiter-expertise-help" className="text-xs leading-5 text-ink-muted">Separate areas with commas. Up to 12 areas, 40 characters each.</p></div>
            <div className="grid gap-1.5"><label htmlFor="recruiter-bio" className="text-sm font-medium text-ink">Bio</label><textarea id="recruiter-bio" name="bio" rows={3} maxLength={1000} value={draft.bio} onChange={event=>setDraft({...draft,bio:event.target.value})} aria-describedby="recruiter-bio-help" className={`${recruiterInput} resize-y`}/><p id="recruiter-bio-help" className="text-xs text-ink-muted">A short introduction to your recruiting work. {draft.bio.length}/1,000</p></div>
          </fieldset>
          <dl className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2"><Detail label="Work email">{profile.work_email}</Detail><Detail label="Company">{profile.company_name}</Detail></dl>
          <p className="text-xs leading-5 text-ink-muted">Work email and company are managed through your account and organization.</p>
        </form>:<dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <Detail label="Work email"><span className="inline-flex max-w-full items-start gap-1.5"><span className="min-w-0 break-all">{profile.work_email}</span>{profile.work_email_verified&&<svg role="img" aria-label="Verified work email" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 fill-none stroke-current text-indigo" strokeWidth="1.8"><path d="m12 2 3 2 4 1 1 4 2 3-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-3 1-4 4-1Z"/><path d="m8 12 3 3 5-6"/></svg>}</span></Detail>
          <Detail label="Work phone">{profile.work_phone}</Detail>
          <Detail label="Designation">{profile.designation}</Detail>
          <Detail label="Company">{profile.company_name}</Detail>
          <Detail label="Location">{profile.location}</Detail>
          <Detail label="Areas of expertise">{profile.expertise.length?<span className="flex flex-wrap gap-1.5">{profile.expertise.map(area=><span key={area} className="rounded-md bg-indigo-soft px-2 py-0.5 text-xs text-ink">{area}</span>)}</span>:null}</Detail>
          <Detail label="Bio" className="sm:col-span-2"><span className="whitespace-pre-wrap">{profile.bio||"Not added"}</span></Detail>
        </dl>}
      </>}
    </RecruiterModal>
  </>;
}
