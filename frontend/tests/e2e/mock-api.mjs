import http from "node:http";
import { URL } from "node:url";
import adminCatalog from "../../lib/admin-permission-catalog.json" with { type: "json" };

const host = "127.0.0.1";
const port = Number(process.env.E2E_MOCK_API_PORT || "18080");
const webOrigin = process.env.E2E_WEB_ORIGIN || "http://127.0.0.1:3000";

const now = () => new Date().toISOString();
const candidateID = "10000000-0000-4000-8000-000000000001";
const recruiterID = "20000000-0000-4000-8000-000000000001";
const adminID = "30000000-0000-4000-8000-000000000001";
const companyID = "40000000-0000-4000-8000-000000000001";
const verificationID = "50000000-0000-4000-8000-000000000001";
const jobID = "60000000-0000-4000-8000-000000000001";

// Synthetic, metadata-only records for isolated Master Admin view tests.
function adminApplications() {
  return Array.from({length:30},(_,i)=>({id:`70000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,candidate_id:candidateID,
    job_id:jobID,job_reference:"SWX-JOB-2026-00001",job_title:"Senior Go Platform Engineer",company_id:companyID,
    company_name:"Acme Hiring India",organization_country:"IN",stage:i===0?"offer":i===1?"hired":"screening",source:"platform",
    applied_at:now(),updated_at:now()}));
}
function filterRecruitment(items,url) {
  return items.filter(item=>(!url.searchParams.get("company_id")||item.company_id===url.searchParams.get("company_id")) &&
    (!url.searchParams.get("country")||item.organization_country===url.searchParams.get("country").toUpperCase()) &&
    (!url.searchParams.get("job_id")||item.job_id===url.searchParams.get("job_id")) &&
    (!url.searchParams.get("stage")||item.stage===url.searchParams.get("stage")) &&
    (!url.searchParams.get("from")||item.applied_at>=url.searchParams.get("from")) &&
    (!url.searchParams.get("before")||item.applied_at<url.searchParams.get("before")) &&
    (!url.searchParams.get("q")||`${item.id} ${item.candidate_id} ${item.job_reference} ${item.job_title} ${item.company_name}`.toLowerCase().includes(url.searchParams.get("q").toLowerCase())));
}
function adminPage(items,url) {
  const page=Math.max(1,Number(url.searchParams.get("page")||1)),limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit")||25)));
  return {items:items.slice((page-1)*limit,page*limit),total:items.length,page,limit};
}

function initialState() {
  return {
    requests: [],
    profile: {
      user_id: candidateID,
      email: "candidate@example.com",
      phone: "+919876543210",
      full_name: "Aarav Candidate",
      headline: "",
      current_city: "",
      current_state: "",
      country_code: "IN",
      total_experience_months: 24,
      notice_period_days: null,
      profile_completion: 25,
    },
    profileDetails: {
      details: {},
      current_salary_currency: "INR",
      expected_salary_currency: "INR",
      cv_original_filename: null,
      last_active_at: now(),
      profile_updated_at: now(),
    },
    pendingCVFilename: null,
    stages: new Map(),
    verificationStatus: "pending",
    accountStatuses: {},
    accountResets: {},
    adminAccess: { enabled: false, assigned: true, admin_role: "support_admin", mfa_enrolled: false, mfa_verified: false },
  };
}

let state = initialState();

const corsHeaders = {
  "access-control-allow-origin": webOrigin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type,x-amz-server-side-encryption",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...corsHeaders,
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function noContent(res) {
  res.writeHead(204, corsHeaders);
  res.end();
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function roleFromCookie(req) {
  const cookie = req.headers.cookie ?? "";
  const match = cookie.match(/(?:^|;\s*)swx_e2e_role=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function logRequest(req, url, payload) {
  if (url.pathname.startsWith("/__e2e")) return;
  const safePayload = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, /password|code|secret|token/i.test(key) ? "[redacted]" : value]));
  state.requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams.entries()), search: url.search, body: safePayload, at: now() });
  if (state.requests.length > 300) state.requests.shift();
}

function job(overrides = {}) {
  return {
    id: jobID,
    job_reference: "SWX-JOB-2026-00001",
    company_name: "Sapien Labs India",
    title: "Senior Go Platform Engineer",
    department: "Engineering",
    description: "Build efficient recruitment infrastructure with Go and PostgreSQL.",
    employment_type: "full_time",
    work_mode: "hybrid",
    city: "Mumbai",
    state: "Maharashtra",
    country_code: "IN",
    min_experience_months: 24,
    max_experience_months: 72,
    min_salary_amount: 800000,
    max_salary_amount: 1800000,
    salary_currency: "INR",
    openings: 3,
    published_at: now(),
    required_skills: ["Go", "PostgreSQL", "AWS"],
    ...overrides,
  };
}

function pipelineRows() {
  return Array.from({ length: 10 }, (_, index) => {
    const n = index + 1;
    const appID = `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    return {
      application_id: appID,
      candidate_id: `71000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      candidate_name: `Candidate ${String(n).padStart(3, "0")}`,
      headline: n % 2 ? "Backend engineer" : "Platform engineer",
      city: n % 2 ? "Mumbai" : "Pune",
      experience_months: 24 + n,
      notice_period_days: 15,
      job_id: jobID,
      job_title: "Senior Go Platform Engineer",
      stage: state.stages.get(appID) ?? (n === 1 ? "screening" : "new_application"),
      applied_at: new Date(Date.now() - n * 86400000).toISOString(),
      updated_at: now(),
    };
  });
}

function profileSummary() {
  return {
    full_name: state.profile.full_name,
    headline: state.profile.headline,
    email: state.profile.email,
    email_verified: true,
    primary_phone: state.profile.phone,
    current_location: [state.profile.current_city, state.profile.current_state].filter(Boolean).join(", "),
    preferred_locations: String(state.profileDetails.details.preferred_locations ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    total_experience_months: state.profile.total_experience_months,
    profile_completion: state.profile.profile_completion,
    share_token: "e2e-public-profile-token",
    profile_visible: Boolean(state.profileDetails.details.profile_visible_in_sourcing),
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${host}:${port}`);
  if (req.method === "OPTIONS") return noContent(res);
  if (url.pathname === "/healthz") return json(res, 200, { ok: true });
  if (url.pathname === "/__e2e/reset" && req.method === "POST") { state = initialState(); return json(res, 200, { reset: true }); }
  if (url.pathname === "/__e2e/requests" && req.method === "GET") return json(res, 200, { items: state.requests });
  if (url.pathname === "/__e2e/state" && req.method === "GET") return json(res, 200, { ...state, stages: Object.fromEntries(state.stages) });

  const payload = ["POST", "PATCH", "PUT"].includes(req.method ?? "") ? await body(req) : {};
  logRequest(req, url, payload);

  // Synthetic browser scenarios only. This controller never exists in Go.
  if (url.pathname === "/__e2e/admin-security" && req.method === "POST" && process.env.ADMIN_SECURITY_E2E === "1") {
    state.adminAccess = { ...state.adminAccess, ...payload };
    return json(res, 200, { configured: true });
  }
  if (url.pathname === "/api/v1/admin/access") {
    if (roleFromCookie(req) !== "master_admin") return json(res, 403, { error: { message: "administrator access denied" } });
    if (state.adminAccess.fail) return json(res, 503, { error: { message: "administrator security is unavailable" } });
    return json(res, 200, { ...state.adminAccess, permissions: adminCatalog[state.adminAccess.admin_role] ?? [] });
  }
  if (url.pathname.startsWith("/api/v1/admin/security/mfa/") && req.method === "POST") {
    if (roleFromCookie(req) !== "master_admin" || !state.adminAccess.enabled || !state.adminAccess.assigned) return json(res, 403, { error: { message: "approved role required" } });
    if (payload.password !== "E2e-password-123!") return json(res, 400, { error: { message: "password or authenticator code is invalid, expired or already used" } });
    if (url.pathname.endsWith("/enroll")) return json(res, 200, { secret: "JBSWY3DPEHPK3PXP", expires_at: new Date(Date.now() + 600000).toISOString() });
    if (payload.code !== "123456") return json(res, 400, { error: { message: "password or authenticator code is invalid, expired or already used" } });
    state.adminAccess.mfa_enrolled = true; state.adminAccess.mfa_verified = true;
    return json(res, 200, { verified: true });
  }

  if (/^\/api\/v1\/admin\/(applications|interviews)(\/|$)/.test(url.pathname)) {
    if (roleFromCookie(req)!=="master_admin"||(state.adminAccess.enabled && (!state.adminAccess.assigned||!state.adminAccess.mfa_verified||!adminCatalog[state.adminAccess.admin_role]?.includes("recruitment.read")))) return json(res,403,{error:{message:"recruitment access denied"}});
    if(req.method!=="GET") return json(res,405,{error:{message:"read-only resource"}});
    const company=url.searchParams.get("company_id"),country=url.searchParams.get("country"),stage=url.searchParams.get("stage");
    if ((company&&!/^[0-9a-f-]{36}$/i.test(company))||(country&&!/^[A-Za-z]{2}$/.test(country))||(stage&&!["new_application","screening","shortlisted","technical_interview","hr_round","final_interview","offer","hired","rejected","withdrawn"].includes(stage))) return json(res,400,{error:{message:"invalid filters"}});
    const history=url.pathname.match(/^\/api\/v1\/admin\/applications\/([^/]+)\/history$/);
    if(history) {
      const application=adminApplications().find(item=>item.id===history[1]);
      if(!application) return json(res,404,{error:{message:"application not found"}});
      return json(res,200,{application,...adminPage([
        {id:"90000000-0000-4000-8000-000000000001",kind:"stage_changed",actor_id:recruiterID,occurred_at:now(),changes:{previous_stage:"screening",new_stage:application.stage}},
        {id:application.id,kind:"application_submitted",occurred_at:application.applied_at,changes:{source:"platform"}},
      ],url)});
    }
    const apps=filterRecruitment(adminApplications(),url);
    if(url.pathname.endsWith("/interviews")) return json(res,200,adminPage(apps.slice(0,2).map((a,i)=>({id:`80000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,application_id:a.id,candidate_id:a.candidate_id,job_id:a.job_id,job_reference:a.job_reference,job_title:a.job_title,company_id:a.company_id,company_name:a.company_name,recruiter_id:recruiterID,scheduled_at:new Date(Date.now()+86400000).toISOString(),duration_minutes:45,round_label:"Technical interview",status:"scheduled",created_at:now()})).filter(i=>!url.searchParams.get("status")||i.status===url.searchParams.get("status")),url));
    return json(res,200,adminPage(apps,url));
  }


  if (url.pathname === "/__e2e/cv-upload" && req.method === "PUT") {
    if (req.headers["content-type"] !== "application/pdf") return json(res, 400, { error: { message: "PDF content type required" } });
    if (req.headers["x-amz-server-side-encryption"] !== "AES256") return json(res, 400, { error: { message: "encryption header required" } });
    return noContent(res);
  }
  if (url.pathname === "/__e2e/cv-download" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/pdf", ...corsHeaders });
    res.end("%PDF-1.4 e2e");
    return;
  }

  if (url.pathname === "/api/v1/auth/candidate/register" && req.method === "POST") {
    state.profile.email = String(payload.email ?? state.profile.email);
    state.profile.full_name = String(payload.full_name ?? state.profile.full_name);
    state.profile.phone = String(payload.phone ?? state.profile.phone);
    return json(res, 201, { email: state.profile.email, development_otp: "123456" });
  }
  if (url.pathname === "/api/v1/auth/otp/verify" && req.method === "POST") return json(res, 200, { verified: true });
  if (url.pathname === "/api/v1/auth/otp/resend" && req.method === "POST") return json(res, 202, { accepted: true, development_otp: "123456" });
  if (url.pathname === "/api/v1/auth/email/request" && req.method === "POST") return json(res, 200, { development_code: "654321", delivery_configured: true });
  if (url.pathname === "/api/v1/auth/email/verify" && req.method === "POST") return json(res, 200, { status: "active" });
  if (url.pathname === "/api/v1/auth/login" && req.method === "POST") {
    const role = String(payload.role ?? "candidate");
    return json(res, 200, { access_token: "e2e-access", refresh_token: "e2e-refresh", expires_in: 900 }, { "set-cookie": `swx_e2e_role=${encodeURIComponent(role)}; Path=/; HttpOnly; SameSite=Lax` });
  }
  if (url.pathname === "/api/v1/auth/logout" && req.method === "POST") return json(res, 200, {}, { "set-cookie": "swx_e2e_role=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
  if (url.pathname === "/api/v1/auth/me" && req.method === "GET") {
    const role = roleFromCookie(req);
    if (!role) return json(res, 401, { error: { message: "authentication required" } });
    const id = role === "candidate" ? candidateID : role === "recruiter" ? recruiterID : adminID;
    return json(res, 200, { id, role, first_name: role === "candidate" ? state.profile.full_name.split(" ")[0] : "", last_name: "", headline: "" });
  }

  if (url.pathname === "/api/v1/candidate/profile" && req.method === "GET") return json(res, 200, state.profile);
  if (url.pathname === "/api/v1/candidate/profile" && req.method === "PATCH") {
    state.profile = { ...state.profile, ...payload, profile_completion: 82 };
    return json(res, 200, state.profile);
  }
  if (url.pathname === "/api/v1/candidate/profile/details" && req.method === "GET") return json(res, 200, state.profileDetails);
  if (url.pathname === "/api/v1/candidate/profile/details" && req.method === "PATCH") {
    state.profileDetails = { ...state.profileDetails, ...payload, details: payload.details ?? state.profileDetails.details, profile_updated_at: now() };
    return json(res, 200, state.profileDetails);
  }
  if (url.pathname === "/api/v1/candidate/profile/summary" && req.method === "GET") return json(res, 200, profileSummary());
  if (url.pathname === "/api/v1/candidate/cv/presign" && req.method === "POST") {
    state.pendingCVFilename = String(payload.filename ?? "resume.pdf");
    return json(res, 200, {
      upload: {
        url: `http://${host}:${port}/__e2e/cv-upload`,
        method: "PUT",
        headers: { "Content-Type": "application/pdf", "X-Amz-Server-Side-Encryption": "AES256" },
        expires_at: new Date(Date.now() + 300000).toISOString(),
      },
      filename: state.pendingCVFilename,
    });
  }
  if (url.pathname === "/api/v1/candidate/cv/complete" && req.method === "POST") {
    state.profileDetails.cv_original_filename = state.pendingCVFilename;
    state.pendingCVFilename = null;
    return noContent(res);
  }
  if (url.pathname === "/api/v1/candidate/cv" && req.method === "GET") {
    if (!state.profileDetails.cv_original_filename) return json(res, 404, { error: { message: "CV not found" } });
    return json(res, 200, {
      download: {
        url: `http://${host}:${port}/__e2e/cv-download`,
        method: "GET",
        expires_at: new Date(Date.now() + 300000).toISOString(),
      },
      filename: state.profileDetails.cv_original_filename,
    });
  }
  if (url.pathname === "/api/v1/candidate/recommendations" && req.method === "GET") return json(res, 200, { items: [], minimum_match: 65 });
  if (url.pathname === "/api/v1/candidate/saved-jobs" && req.method === "GET") return json(res, 200, { items: [] });
  if (url.pathname === "/api/v1/candidate/jobs" && req.method === "GET") {
    const page = Number(url.searchParams.get("page") ?? 1);
    const items = Array.from({ length: 10 }, (_, i) => job({ id: `${jobID.slice(0, -2)}${String(i + 1).padStart(2, "0")}`, title: i === 0 ? "Senior Go Platform Engineer" : `Platform Engineer ${i + 1}` }));
    return json(res, 200, { items, page, limit: 10, total: 24 });
  }

  if (url.pathname === "/api/v1/recruiter/dashboard" && req.method === "GET") return json(res, 200, {
    recruiter_name: "Riya Recruiter",
    company_name: "Sapien Labs India",
    active_jobs: 12,
    applications: 1000,
    shortlisted: 85,
    upcoming_interviews: 14,
    offers: 7,
    hires: 5,
    placement_rate: 5.8,
    recent_applications: pipelineRows().slice(0, 6),
    needs_attention: [],
  });
  if (url.pathname === "/api/v1/recruiter/jobs" && req.method === "GET") return json(res, 200, { items: [{ ...job(), applications: 1000, status: "active", updated_at: now() }] });
  if (url.pathname === "/api/v1/recruiter/pipeline" && req.method === "GET") {
    const page = Number(url.searchParams.get("page") ?? 1);
    let items = pipelineRows();
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const stage = url.searchParams.get("stage") ?? "";
    if (q) items = items.filter((row) => `${row.candidate_name} ${row.headline}`.toLowerCase().includes(q));
    if (stage) items = items.filter((row) => row.stage === stage);
    return json(res, 200, { items, page, limit: 10, total: q || stage ? items.length : 1000 });
  }
  const stageMatch = url.pathname.match(/^\/api\/v1\/recruiter\/applications\/([^/]+)\/stage$/);
  if (stageMatch && req.method === "PATCH") {
    state.stages.set(stageMatch[1], String(payload.stage ?? "new_application"));
    return json(res, 200, { updated: true });
  }

  // Aggregate fixtures for the isolated admin dashboard UI; never production data.
  if (url.pathname === "/api/v1/admin/dashboard" && req.method === "GET") {
    if (roleFromCookie(req) !== "master_admin") return json(res, 403, { error: { message: "administrator access denied" } });
    if (state.adminAccess.dashboardFail) return json(res, 503, { error: { message: "snapshot unavailable" } });
    const period = url.searchParams.get("period") || "7d";
    const end = new Date();
    const start = new Date(end.toISOString().slice(0, 10) + "T00:00:00Z");
    if (period === "7d") start.setUTCDate(start.getUTCDate() - 6);
    else if (period === "30d") start.setUTCDate(start.getUTCDate() - 29);
    else if (period === "month") start.setUTCDate(1);
    else if (period === "quarter") { start.setUTCDate(1); start.setUTCMonth(Math.floor(start.getUTCMonth()/3)*3); }
    else if (period === "custom") {
      const from = url.searchParams.get("from") || "";
      const to = url.searchParams.get("to") || "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from || to > end.toISOString().slice(0,10)) return json(res,400,{error:{message:"invalid window"}});
      start.setTime(Date.parse(from + "T00:00:00Z"));
      end.setTime(Math.min(Date.now(), Date.parse(to + "T00:00:00Z") + 86400000));
    } else if (period !== "today") return json(res,400,{error:{message:"invalid window"}});
    const values = { registered_users: 4, candidates: 2, recruiters: 1, verified_recruiters: 1, organizations: 1, published_jobs: 1, draft_jobs: 1, applications: 4, scheduled_interviews: 2, offer_stage_applications: 1, hired_stage_applications: 1, pending_company_reviews: state.verificationStatus === "pending" ? 1 : 0, pending_accounts: 1, pending_privacy_requests: 2, open_privacy_incidents: 1, new_users: period === "today" ? 1 : 3, jobs_published: 1, new_applications: period === "today" ? 1 : 4, active_conversations: 1, admin_access_denials: 0 };
    const company=url.searchParams.get("company_id")||"",country=(url.searchParams.get("country")||"").toUpperCase();
    if((company&&!/^[0-9a-f-]{36}$/i.test(company))||(country&&!/^[A-Z]{2}$/.test(country))) return json(res,400,{error:{message:"invalid scope"}});
    if(company||country) {
      if((company&&company!==companyID)||(country&&country!=="IN")) for(const key of Object.keys(values)) { if(!["pending_privacy_requests","open_privacy_incidents","admin_access_denials"].includes(key)) values[key]=0; }
      else { values.registered_users=3; values.applications=30; values.new_applications=30; }
    }
    if (state.adminAccess.dashboardEmpty) for (const key of Object.keys(values)) values[key] = 0;
    return json(res, 200, { ...values, company_id:company,country,computed_at: now(), period, from: start.toISOString(), to: end.toISOString() });
  }
  if (url.pathname === "/api/v1/admin/metrics" && req.method === "GET") return json(res, 200, {
    metric_date: now().slice(0, 10), total_active_users: 12540, active_jobs: 321, total_candidates: 11800,
    jobs_posted_today: 42, sns_sms_sent_today: 18, sns_sms_sent_billing_cycle: 430,
    sns_billing_cycle_start: new Date(Date.now() - 10 * 86400000).toISOString(), pending_company_reviews: state.verificationStatus === "pending" ? 1 : 0, computed_at: now(),
  });
  if (url.pathname === "/api/v1/admin/company-verifications" && req.method === "GET") {
    const requested = url.searchParams.get("status") ?? "pending";
    const item = { id: verificationID, company_id: companyID, recruiter_user_id: recruiterID, company_name: "Acme Hiring India", registration_doc_url: "s3://private-bucket/acme.pdf", status: state.verificationStatus, created_at: now(), updated_at: now() };
    const items = requested === state.verificationStatus && (!url.searchParams.get("company_id")||url.searchParams.get("company_id")===companyID)&&(!url.searchParams.get("country")||url.searchParams.get("country").toUpperCase()==="IN") ? [item] : [];
    return json(res, 200, { items, page: 1, limit: Number(url.searchParams.get("limit") ?? 25), total: items.length });
  }
  if (url.pathname === "/api/v1/admin/users" && req.method === "GET") {
    let items = [{ id: candidateID, role: "candidate", status: state.accountStatuses[candidateID] || "active", name: "Aarav Candidate", email: "candidate@example.invalid", email_verified_at: now(), is_active: true, force_password_reset: Boolean(state.accountResets[candidateID]), created_at: now(), last_login_at: now() }];
    if (state.adminAccess.governanceFull) items.push(
      { id: recruiterID, role: "recruiter", status: "active", name: "Riya Recruiter", email: "recruiter@example.invalid", email_verified_at: now(), is_active: true, company_id: companyID, company_name: "Acme Hiring India", recruiter_verification: "verified", force_password_reset: false, created_at: now() },
      { id: adminID, role: "master_admin", status: "active", name: "Protected Administrator", email: "admin@example.invalid", email_verified_at: now(), is_active: true, force_password_reset: false, created_at: now() },
      { id: "10000000-0000-4000-8000-000000000002", role: "candidate", status: "disabled", name: "Disabled Candidate", email: "disabled@example.invalid", email_verified_at: now(), is_active: true, force_password_reset: false, created_at: now() },
    );
    const q = (url.searchParams.get("q") || "").toLowerCase();
    items = items.filter((item) => (!q || `${item.id} ${item.name} ${item.email}`.toLowerCase().includes(q)) && (!url.searchParams.get("role") || item.role === url.searchParams.get("role")) && (!url.searchParams.get("status") || item.status === url.searchParams.get("status")) && (!url.searchParams.get("company_id") || item.company_id === url.searchParams.get("company_id")));
    return json(res,200,{ items, page: 1, limit: 25, total: items.length });
  }
  if (url.pathname === "/api/v1/admin/organizations" && req.method === "GET") {
    let items = [{ id: companyID, legal_name: "Acme Hiring India Private Limited", display_name: "Acme Hiring India", work_email_domain: "acme.example.invalid", website_url: "https://acme.example.invalid", country_code: "IN", verification_status: state.verificationStatus === "approved" ? "verified" : "pending", created_at: now(), recruiters: 1, active_jobs: 1, applications: 4 }];
    const q = (url.searchParams.get("q") || "").toLowerCase();
    items = items.filter((item) => (!q || `${item.id} ${item.display_name} ${item.legal_name} ${item.work_email_domain}`.toLowerCase().includes(q)) && (!url.searchParams.get("verification") || item.verification_status === url.searchParams.get("verification")) && (!url.searchParams.get("country") || item.country_code === url.searchParams.get("country").toUpperCase()));
    return json(res,200,{ items, page: 1, limit: 25, total: items.length });
  }
  const accountAction = url.pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/(suspend|reactivate|force-password-reset|revoke-sessions)$/);
  const summaryMatch=url.pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/summary$/);
  if(summaryMatch&&req.method==="GET") {
    if(roleFromCookie(req)!=="master_admin"||(state.adminAccess.enabled&&(!state.adminAccess.assigned||!state.adminAccess.mfa_verified||!adminCatalog[state.adminAccess.admin_role]?.includes("users.read")))) return json(res,403,{error:{message:"account access denied"}});
    const id=summaryMatch[1];if(![candidateID,recruiterID,adminID].includes(id)) return json(res,404,{error:{message:"account unavailable"}});
    return json(res,200,{id,role:id===candidateID?"candidate":id===recruiterID?"recruiter":"master_admin",status:state.accountStatuses[id]||"active",created_at:now(),active_sessions:1,computed_at:now(),consent:{events:4,latest_purposes:3,latest_granted:1,latest_denied_or_withdrawn:2,last_recorded_at:now()},...(id===candidateID?{candidate:{onboarding:"review_required",method:"cv",profile_completion:85,discoverable:true,contact_sharing:false,resume_uploaded:true,updated_at:now(),applications:2}}:id===recruiterID?{recruiter:{company_id:companyID,verification:"verified",jobs_owned:2,active_jobs_owned:1,applications_to_owned_jobs:3,stage_changes:1,interview_changes:1,last_recorded_workflow:now()}}:{})});
  }
  if (accountAction && req.method === "POST") {
    if (state.adminAccess.actionConflict) return json(res,409,{error:{message:"Refresh this record. Its current state or verification requirements do not permit this action."}});
    if (String(payload.reason || "").trim().length < 5) return json(res,400,{error:{message:"A justification is required."}});
    if (accountAction[2] === "suspend") state.accountStatuses[accountAction[1]] = "suspended";
    if (accountAction[2] === "reactivate") state.accountStatuses[accountAction[1]] = "active";
    if (accountAction[2] === "force-password-reset") state.accountResets[accountAction[1]] = true;
    return json(res,200,{updated:true});
  }
  if (url.pathname === "/api/v1/admin/jobs" && req.method === "GET") return json(res, 200, { items: [{ ...job(), company_id: companyID, recruiter_user_id: recruiterID, recruiter_name: "Example Recruiter", status: "active", updated_at: now(), application_count: 4 }], page: 1, limit: 25, total: 1 });
  if (url.pathname === "/api/v1/admin/budget-settings" && req.method === "GET") return json(res, 200, { sns_sms_warning_count: 1000, sns_sms_critical_count: 2000, updated_at: now() });
  if (url.pathname === "/api/v1/admin/audit-logs" && req.method === "GET") return json(res, 200, { items: [], total: 0, page: 1, limit: 50 });
  if (url.pathname.startsWith("/api/v1/admin/privacy/") && req.method === "GET") return json(res, 200, { items: [] });
  const approveMatch = url.pathname.match(/^\/api\/v1\/admin\/company-verifications\/([^/]+)\/approve$/);
  if (approveMatch && req.method === "POST") {
    state.verificationStatus = "approved";
    return json(res, 200, { approved: true });
  }
  const rejectMatch = url.pathname.match(/^\/api\/v1\/admin\/company-verifications\/([^/]+)\/reject$/);
  if (rejectMatch && req.method === "POST") { state.verificationStatus = "rejected"; return json(res,200,{reviewed:true,status:"rejected"}); }

  return json(res, 404, { error: { message: `No E2E mock for ${req.method} ${url.pathname}` } });
});

server.listen(port, host, () => console.log(`SapienWorx E2E mock API on http://${host}:${port}`));
