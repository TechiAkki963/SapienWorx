import type {OfferList} from "@/lib/offers";
import Link from "next/link";
import {CandidateReferralList} from "@/lib/candidate-referrals";
import {CandidateOverviewIdentity} from "@/components/candidate/candidate-overview-identity";
import {JobCard} from "@/components/candidate/job-card";
import {OverviewAlerts} from "@/components/candidate/overview-alerts";
import {CareerIcon} from "@/components/candidate/career-icon";
import {WorkspaceError} from "@/components/candidate/workspace-error";
import {WorkspaceRetry} from "@/components/candidate/workspace-retry";
import {candidateStageLabel} from "@/components/candidate/workspace-job-utils";
import {Surface} from "@/components/ui/surface";
import {LocalTimeGreeting} from "@/components/ui/local-time-greeting";
import {CandidateDashboard, CandidateInterview, CandidateProfileDetails, CandidateProfileMetrics, candidateOnboardingStatus} from "@/lib/candidate";
import {candidateAPI} from "@/lib/candidate-server";

export default async function CandidateDashboardPage() {
  let dashboard: CandidateDashboard;
  try { dashboard = await candidateAPI<CandidateDashboard>("/api/v1/candidate/dashboard"); }
  catch { return <WorkspaceError title="We couldn’t load your overview." />; }
  const [details, metrics, referrals, interviews, offers] = await Promise.all([
    candidateAPI<CandidateProfileDetails>("/api/v1/candidate/profile/details").catch(() => null),
    candidateAPI<CandidateProfileMetrics>("/api/v1/candidate/profile/metrics").catch(() => null),
    candidateAPI<CandidateReferralList>("/api/v1/candidate/referral-invitations?limit=1&page=1").catch(()=>null),
    candidateAPI<{items:CandidateInterview[]}>("/api/v1/candidate/interviews").catch(()=>null),
    candidateAPI<OfferList>("/api/v1/candidate/offers?page=1&limit=1").catch(()=>null),
  ]);
  const onboarding = details ? candidateOnboardingStatus(details) : null;
  const firstName = dashboard.profile.full_name.split(" ")[0] || "there";
  const upcoming=interviews?.items?.filter(item=>!["cancelled","completed"].includes(item.status)&&new Date(item.scheduled_at).getTime()>Date.now()).sort((a,b)=>new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime())||[];
  const stats=[
    {label:"Applications",value:dashboard.application_count,detail:"Submitted applications",icon:"application" as const,href:"/candidate/applications"},
    {label:"Interviews",value:interviews?upcoming.length:null,detail:"Upcoming interviews",icon:"calendar" as const,href:"/candidate/interviews"},
    {label:"Saved jobs",value:dashboard.saved_count,detail:"Ready to revisit",icon:"bookmark" as const,href:"/candidate/saved"},
    {label:"Profile completion",value:Math.max(0,Math.min(100,dashboard.profile.profile_completion)),detail:"Complete your profile",icon:"person" as const,href:"/candidate/profile?panel=completion#profile-completion",percent:true},
  ];
  const performance=[
    {label:"Profile views",value:metrics?.profile_views,detail:"Verified recruiters",explanation:"Verified recruiters who opened your professional profile in the last 30 days. Each recruiter is counted once."},
    {label:"Search appearances",value:metrics?.search_appearances,detail:"Recruiter search results",explanation:"Times your profile appeared in verified recruiter search results in the last 30 days, counted once per recruiter per day."},
    {label:"Recruiter actions",value:metrics?.recruiter_actions,detail:"Recruiters who took action",explanation:"Verified recruiters who saved, messaged, viewed your CV or progressed an application in the last 30 days. Passive views are excluded; each recruiter is counted once."},
  ];
  const quickActions=[
    {label:"Search jobs",detail:"Find your next opportunity",href:"/candidate/jobs",icon:"search" as const},
    {label:"Upload resume",detail:"Keep your experience current",href:"/candidate/profile#section-resume",icon:"application" as const},
    {label:"Update profile",detail:"Show your professional strengths",href:"/candidate/profile?edit=intro",icon:"person" as const},
    {label:"Track applications",detail:"Follow your progress",href:"/candidate/applications",icon:"calendar" as const},
  ];
  return <div className="candidate-overview grid gap-5">
    <header><p className="text-sm text-ink-muted"><LocalTimeGreeting firstName={firstName}/>.</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Your overview</h1><p className="mt-2 text-sm text-ink-muted">Keep your profile current, follow applications and find your next opportunity.</p></header>
    {onboarding&&["manual_started","cv_started","in_progress","review_required"].includes(onboarding)&&<Surface tone="lavender" className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm">Your profile is in progress. Continue at your own pace.</p><Link href="/candidate/onboarding" className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo">Continue profile setup →</Link></Surface>}
    <CandidateOverviewIdentity profile={dashboard.profile} details={details}/>
    <section aria-label="Your job search at a glance" className="candidate-dashboard-stats">{stats.map(stat=><Link className="candidate-dashboard-stat" key={stat.label} href={stat.href}><span className="candidate-dashboard-icon"><CareerIcon name={stat.icon} size={24}/></span><div><h2>{stat.label}</h2><strong>{stat.value==null?"Unavailable":stat.value.toLocaleString("en-IN")+(stat.percent?"%":"")}</strong><p>{stat.detail}</p></div></Link>)}</section>
    <div className="candidate-dashboard-columns">
      <div className="candidate-dashboard-primary">
        <Surface className="candidate-dashboard-section"><div className="candidate-section-heading"><div><h2>Recommended for you</h2><p>Opportunities based on your profile and preferences.</p></div><Link href="/candidate/jobs">View all jobs →</Link></div>{dashboard.recommended_jobs?.length?<div className="candidate-overview-jobs">{dashboard.recommended_jobs.map(job=><JobCard job={job} key={job.id} compact hrefBase="/candidate/jobs" canSave/>)}</div>:<div className="candidate-overview-empty"><p className="font-semibold">No active recommendations yet.</p><p>Published roles will appear here. You can explore Jobs anytime.</p></div>}</Surface>
        <Surface className="candidate-dashboard-section"><div className="candidate-section-heading"><div><h2>Recent applications</h2><p>Follow the progress of your submitted applications.</p></div><Link href="/candidate/applications">Open tracker →</Link></div>{dashboard.recent_applications?.length?<div className="candidate-overview-table-wrap"><table className="candidate-overview-table"><thead><tr><th scope="col">Job title</th><th scope="col">Company</th><th scope="col">Applied on</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{dashboard.recent_applications.map(app=><tr key={app.id}><td data-label="Job title"><Link href={`/candidate/jobs/${app.job_id}`}>{app.job_title}</Link></td><td data-label="Company">{app.company_name}</td><td data-label="Applied on"><time dateTime={app.applied_at}>{new Date(app.applied_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"})}</time></td><td data-label="Status"><span className="candidate-overview-stage">{candidateStageLabel(app.stage)}</span></td><td><Link className="candidate-overview-row-action" href="/candidate/applications" aria-label={`Track ${app.job_title}`}>View →</Link></td></tr>)}</tbody></table></div>:<p className="candidate-overview-empty">You haven’t applied to a role yet.</p>}</Surface>
        <section aria-label="Profile performance"><div className="candidate-section-heading"><h2>Profile performance</h2><p>Last 30 days · Aggregate information only</p></div>{!metrics&&<p role="alert" className="candidate-error mb-3">Your profile metrics could not be loaded. <WorkspaceRetry href="/candidate"/></p>}<div className="candidate-metrics candidate-overview-performance">{performance.map(card=><article key={card.label}><h3>{card.label}<details className="candidate-tooltip"><summary aria-label={`About ${card.label}`}>?</summary><p>{card.explanation}</p></details></h3><strong>{card.value==null?"Unavailable":card.value.toLocaleString("en-IN")}</strong><p>{card.detail}</p></article>)}</div></section>
      </div>
      <div className="candidate-dashboard-secondary">
        <Surface className="candidate-dashboard-section"><div className="candidate-section-heading"><h2>Quick actions</h2></div><nav aria-label="Quick actions" className="candidate-overview-quick-actions">{quickActions.map(action=><Link href={action.href} key={action.href}><span className="candidate-dashboard-icon"><CareerIcon name={action.icon}/></span><div><h3>{action.label}</h3><p>{action.detail}</p></div><CareerIcon name="arrow" size={16}/></Link>)}</nav></Surface>
        <Surface className="candidate-dashboard-section"><div className="candidate-section-heading"><h2>Upcoming interviews</h2><Link href="/candidate/interviews">View all →</Link></div>{interviews===null?<p role="alert" className="candidate-overview-empty">Your interview schedule is unavailable. <Link href="/candidate/interviews">Try the schedule →</Link></p>:!upcoming.length?<p className="candidate-overview-empty">No upcoming interview scheduled.</p>:<div className="candidate-overview-interviews">{upcoming.slice(0,3).map(item=><Link href="/candidate/interviews" key={item.id}><span className="candidate-interview-date"><span>{new Date(item.scheduled_at).toLocaleDateString("en-GB",{month:"short",timeZone:item.time_zone||"Asia/Kolkata"})}</span><strong>{new Date(item.scheduled_at).toLocaleDateString("en-GB",{day:"numeric",timeZone:item.time_zone||"Asia/Kolkata"})}</strong></span><div><h3>{item.job_title}</h3><p>{item.company_name}</p><p><time dateTime={item.scheduled_at}>{new Date(item.scheduled_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:item.time_zone||"Asia/Kolkata"})}</time> · {item.duration_minutes} min · {item.time_zone||"Asia/Kolkata"}</p></div></Link>)}</div>}</Surface>
        <Surface className="candidate-dashboard-section"><div className="candidate-section-heading"><h2>Alerts &amp; updates</h2><Link href="/candidate/notifications">View all →</Link></div><OverviewAlerts/></Surface>
        <Surface className="candidate-dashboard-section"><div className="candidate-section-heading"><h2>Your offers</h2><Link href="/candidate/offers">Review offers →</Link></div><p className="candidate-overview-empty">{offers===null?"Offer updates are unavailable. Open your offers to try again.":((offers.counts?.sent||0)+(offers.counts?.viewed||0)>0||offers.items?.some(item=>["sent","viewed"].includes(item.status)))?"An offer is ready for your review.":"New offers will appear here when an employer shares them."}</p></Surface>
        {referrals&&referrals.total>0&&<Surface className="candidate-dashboard-section"><div className="candidate-section-heading"><h2>Your referrals</h2><Link href="/candidate/referrals">View referrals →</Link></div><p className="candidate-overview-empty">{referrals.total} personal recommendation{referrals.total===1?"":"s"}. Track broad progress privately.</p></Surface>}
        <Link className="candidate-career-guide-link" href="/candidate/career-hub">Explore career guides <span aria-hidden="true">→</span></Link>
      </div>
    </div>
  </div>;
}
