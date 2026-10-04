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
    failCVPreview: false,
    stages: new Map(),
    verificationStatus: "pending",
    accountStatuses: {},
    accountResets: {},
    messagingThreads: [
      {
        id: "73000000-0000-4000-8000-000000000001",
        recruiter_id: recruiterID,
        candidate_id: candidateID,
        job_id: jobID,
        subject: "Senior Go Platform Engineer opportunity",
        status: "open",
        candidate_name: "Aarav Candidate",
        recruiter_name: "Riya Recruiter",
        job_title: "Senior Go Platform Engineer",
        last_message: "Thanks — I’m interested. Could you share the interview timeline?",
        unread_candidate: 1,
        unread_recruiter: 0,
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 12 * 60000).toISOString(),
      },
      {
        id: "73000000-0000-4000-8000-000000000002",
        recruiter_id: recruiterID,
        candidate_id: candidateID,
        job_id: null,
        subject: "Operations leadership conversation",
        status: "open",
        candidate_name: "Aarav Candidate",
        recruiter_name: "Riya Recruiter",
        job_title: null,
        last_message: "Happy to stay in touch for future roles.",
        unread_candidate: 0,
        unread_recruiter: 1,
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 5 * 3600000).toISOString(),
      },
    ],
    messagingMessages: {
      "73000000-0000-4000-8000-000000000001": [
        {id:"74000000-0000-4000-8000-000000000001",thread_id:"73000000-0000-4000-8000-000000000001",sender_id:recruiterID,sender_type:"recruiter",content:"Hi Aarav, your background looks relevant for our Senior Go Platform Engineer role.",is_read:true,created_at:new Date(Date.now()-90*60000).toISOString()},
        {id:"74000000-0000-4000-8000-000000000002",thread_id:"73000000-0000-4000-8000-000000000001",sender_id:candidateID,sender_type:"candidate",content:"Thanks — I’m interested. Could you share the interview timeline?",is_read:true,created_at:new Date(Date.now()-12*60000).toISOString()},
        {id:"74000000-0000-4000-8000-000000000003",thread_id:"73000000-0000-4000-8000-000000000001",sender_id:recruiterID,sender_type:"recruiter",content:"Absolutely. The next step is a 45-minute technical discussion, followed by the hiring manager round.",is_read:false,created_at:new Date(Date.now()-8*60000).toISOString()},
      ],
      "73000000-0000-4000-8000-000000000002": [
        {id:"74000000-0000-4000-8000-000000000004",thread_id:"73000000-0000-4000-8000-000000000002",sender_id:recruiterID,sender_type:"recruiter",content:"Thanks for connecting. I’ll keep you in mind for operations leadership opportunities.",is_read:true,created_at:new Date(Date.now()-6*3600000).toISOString()},
        {id:"74000000-0000-4000-8000-000000000005",thread_id:"73000000-0000-4000-8000-000000000002",sender_id:candidateID,sender_type:"candidate",content:"Happy to stay in touch for future roles.",is_read:false,created_at:new Date(Date.now()-5*3600000).toISOString()},
      ],
    },
    candidateNotifications: [
      {id:"75000000-0000-4000-8000-000000000001",kind:"inmail",title:"New message from a recruiter",body:"Senior Go Platform Engineer opportunity",action_url:"/candidate/inbox?thread=73000000-0000-4000-8000-000000000001",read_at:null,created_at:new Date(Date.now()-8*60000).toISOString()},
    ],
    messageTemplates: [
      {id:"72000000-0000-4000-8000-000000000001",recruiter_id:recruiterID,title:"Role introduction",subject_template:"{{JobTitle}} opportunity",body_template:"Hi {{CandidateName}}, I would like to discuss our {{JobTitle}} opportunity with you.",created_at:new Date(Date.now()-4*86400000).toISOString(),updated_at:new Date(Date.now()-4*86400000).toISOString()},
      {id:"72000000-0000-4000-8000-000000000002",recruiter_id:recruiterID,title:"Gentle follow-up",subject_template:"Following up about {{JobTitle}}",body_template:"Hi {{CandidateName}}, just following up in case our {{JobTitle}} opportunity is relevant for you.",created_at:new Date(Date.now()-3*86400000).toISOString(),updated_at:new Date(Date.now()-3*86400000).toISOString()},
    ],
    outreachSequences: [
      {
        id:"76000000-0000-4000-8000-000000000001",
        name:"Priority role follow-up",
        status:"active",
        steps:[
          {id:"76100000-0000-4000-8000-000000000001",step_order:1,delay_hours:0,template_id:"72000000-0000-4000-8000-000000000001",title:"Role introduction",subject_template:"{{JobTitle}} opportunity",body_template:"Hi {{CandidateName}}, I would like to discuss our {{JobTitle}} opportunity with you."},
          {id:"76100000-0000-4000-8000-000000000002",step_order:2,delay_hours:48,template_id:"72000000-0000-4000-8000-000000000002",title:"Gentle follow-up",subject_template:"Following up about {{JobTitle}}",body_template:"Hi {{CandidateName}}, just following up in case our {{JobTitle}} opportunity is relevant for you."},
        ],
        created_at:new Date(Date.now()-2*86400000).toISOString(),
        updated_at:new Date(Date.now()-2*86400000).toISOString(),
      },
    ],
    outreachCampaigns: [
      {
        id:"77000000-0000-4000-8000-000000000001",
        name:"Mumbai platform hiring",
        sequence_id:"76000000-0000-4000-8000-000000000001",
        sequence_name:"Priority role follow-up",
        job_id:jobID,
        job_title:"Senior Go Platform Engineer",
        status:"running",
        total_recipients:3,
        sent_count:3,
        skipped_count:0,
        failed_count:0,
        launched_at:new Date(Date.now()-6*3600000).toISOString(),
        created_at:new Date(Date.now()-7*3600000).toISOString(),
        updated_at:new Date(Date.now()-6*3600000).toISOString(),
      },
    ],
    adminAccess: { enabled: false, assigned: true, admin_role: "support_admin", mfa_enrolled: false, mfa_verified: false },
  };
}

let state = initialState();

const corsHeaders = {
  "access-control-allow-origin": webOrigin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type,x-amz-server-side-encryption,x-csrf-token,authorization,x-request-id,x-idempotency-key",
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

function intelligenceDashboard() {
  return {
    runs: [{
      id: "a1000000-0000-4000-8000-000000000001",
      engine_version: "rules-v1",
      status: "completed",
      metrics: { active_jobs: 12, applications_30d: 140, interviews_30d: 18, hires_90d: 6 },
      requested_by: adminID,
      started_at: now(),
      completed_at: now(),
    }],
    insights: [{
      id: "a2000000-0000-4000-8000-000000000001",
      run_id: "a1000000-0000-4000-8000-000000000001",
      domain: "operations",
      insight_key: "parser_review",
      severity: "warning",
      title: "Parser failures need review",
      rationale: "Synthetic E2E evidence indicates a review threshold was crossed.",
      evidence: { parser_failures_24h: 3, parser_events_24h: 40 },
      recommendation: "Review parser failures before changing production behavior.",
      confidence: 0.82,
      status: "new",
      created_at: now(),
    }],
    models: [
      { id: "a3000000-0000-4000-8000-000000000001", engine_type: "matching", version: "1.0.0", provider: "local", model_ref: "deterministic-weighted-v1", config: {}, status: "production", created_at: now(), activated_at: now() },
      { id: "a3000000-0000-4000-8000-000000000002", engine_type: "matching", version: "1.1.0", provider: "local", model_ref: "deterministic-weighted-v2", config: {}, status: "candidate", created_at: now() },
    ],
    evaluations: [{
      id: "a4000000-0000-4000-8000-000000000001",
      model_version_id: "a3000000-0000-4000-8000-000000000002",
      dataset_ref: "synthetic-e2e-labels",
      metrics: { labeled_events: 30, avg_score_positive: 76, avg_score_non_positive: 52 },
      quality_gate_status: "passed",
      started_at: now(),
      completed_at: now(),
      notes: "Synthetic E2E evaluation only.",
    }],
    switches: [
      ["global_intelligence", false, "Master switch for intelligence processing."],
      ["candidate_intelligence", false, "Generate normalized candidate feature records."],
      ["job_intelligence", false, "Generate normalized job feature records."],
      ["cv_intelligence", false, "Process CV-derived intelligence."],
      ["matching", false, "Generate deterministic match results."],
      ["learning_collection", false, "Collect outcome feedback."],
      ["automated_recommendations", false, "Serve intelligence recommendations."],
      ["ai_gateway", false, "Allow governed external AI routing."],
      ["model_deployment", false, "Allow approved model promotion."],
      ["embedding_generation", false, "Generate governed embedding documents."],
      ["semantic_search", false, "Use approved embeddings as a retrieval signal."],
      ["human_review_queue", false, "Create Master Admin review cases for intelligence outputs."],
    ].map(([key, enabled, description]) => ({ key, enabled, requires_approval_to_enable: true, description, changed_at: now() })),
    heartbeats: [{ engine_key: "sapienworx-intelligence", status: "healthy", version: "engine-v2", metadata: { advisory_only: true }, last_seen_at: now() }],
    prompts: [
      {
        id: "a5000000-0000-4000-8000-000000000001",
        prompt_key: "match.explanation",
        version: 1,
        template: "Explain deterministic match evidence only.",
        variables: ["match_components", "job_title"],
        status: "active",
        created_at: now(),
        activated_at: now(),
      },
      {
        id: "a5000000-0000-4000-8000-000000000002",
        prompt_key: "match.explanation",
        version: 2,
        template: "Draft explanation prompt awaiting approval.",
        variables: ["match_components", "job_title"],
        status: "draft",
        created_at: now(),
      },
    ],
    human_reviews: [{
      id: "a6000000-0000-4000-8000-000000000001",
      review_type: "event_failure",
      subject_type: "event",
      subject_id: "a7000000-0000-4000-8000-000000000001",
      priority: "high",
      reason_code: "intelligence.event.max_attempts",
      evidence: { event_type: "job.updated", aggregate_type: "job", attempts: 8 },
      recommendation: { action: "review failure and explicitly replay only after the underlying cause is fixed" },
      status: "open",
      review_note: "",
      created_at: now(),
      updated_at: now(),
    }],
    gateway: { requests_24h: 0, failures_24h: 0, blocked_24h: 0, estimated_cost_24h: 0, avg_latency_ms_24h: 0, redactions_24h: 0 },
    store: { pending_events: 12, failed_events: 0, dead_letters: 1, candidate_features: 42, job_features: 12, match_results: 180, feedback_events: 55, embedding_documents: 0, open_human_reviews: 2, oldest_pending_seconds: 35 },
    computed_at: now(),
    advisory_only: true,
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
      designation: n % 2 ? "Backend Engineer" : "Platform Engineer",
      city: n % 2 ? "Mumbai" : "Pune",
      current_company: "Acme Hiring India",
      previous_company: "",
      education: "",
      university: "",
      preferred_location: "",
      key_skills: "Go, PostgreSQL, AWS",
      photo_data_url: "",
      cv_filename: "",
      saved: false,
      comment_count: 0,
      experience_months: 24 + n,
      notice_period_days: 15,
      job_id: jobID,
      job_title: "Senior Go Platform Engineer",
      job_reference: "SWX-JOB-2026-00001",
      stage: state.stages.get(appID) ?? (n === 1 ? "screening" : "new_application"),
      applied_at: new Date(Date.now() - n * 86400000).toISOString(),
      updated_at: now(),
      profile_updated_at: now(),
      last_active_at: now(),
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
    discoverable_to_recruiters: Boolean(state.profileDetails.details.discoverable_to_recruiters),
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
  if (url.pathname === "/__e2e/admin-security" && req.method === "POST") {
    state.adminAccess = { ...state.adminAccess, ...payload };
    return json(res, 200, { configured: true });
  }
  if (url.pathname === "/api/v1/admin/access") {
    if (roleFromCookie(req) !== "master_admin") return json(res, 403, { error: { message: "administrator access denied" } });
    if (state.adminAccess.fail) return json(res, 503, { error: { message: "administrator security is unavailable" } });
    return json(res, 200, { ...state.adminAccess, permissions: adminCatalog[state.adminAccess.admin_role] ?? [] });
  }
  if (url.pathname === "/api/v1/admin/workforce-taxonomy" && req.method === "GET") {
    if (roleFromCookie(req) !== "master_admin") return json(res, 403, { error: { message: "taxonomy access denied" } });
    return json(res, 200, {
      entity_count: 1284,
      alias_count: 3421,
      relationship_count: 876,
      mapping_count: 4912,
      pending_count: 2,
      provisional_terms: [
        { id: "b1000000-0000-4000-8000-000000000001", raw_term: "Sterile Processing", normalized_term: "sterile processing", proposed_entity_type: "competency", country_scope: "IN", source: "job", source_context: "Healthcare", occurrence_count: 7, status: "pending", first_seen_at: now(), last_seen_at: now() },
        { id: "b1000000-0000-4000-8000-000000000002", raw_term: "Cold Chain Dispatch", normalized_term: "cold chain dispatch", proposed_entity_type: "competency", country_scope: "IN", source: "candidate", source_context: "Logistics", occurrence_count: 4, status: "pending", first_seen_at: now(), last_seen_at: now() },
      ],
      entities: [
        { id: "b2000000-0000-4000-8000-000000000001", entity_type: "competency", canonical_name: "Critical Care Nursing", description: "Clinical critical-care competency", status: "active", country_scope: "IN", language_code: "en", usage_count: 418, metadata: {} },
        { id: "b2000000-0000-4000-8000-000000000002", entity_type: "competency", canonical_name: "Financial Analysis", description: "Finance analysis competency", status: "active", country_scope: "", language_code: "en", usage_count: 365, metadata: {} },
        { id: "b2000000-0000-4000-8000-000000000003", entity_type: "occupation", canonical_name: "Warehouse Supervisor", description: "Logistics occupation", status: "active", country_scope: "IN", language_code: "en", usage_count: 291, metadata: {} },
      ],
    });
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

  if (url.pathname === "/__e2e/onboarding" && req.method === "POST") {
    state.profileDetails.details = { ...state.profileDetails.details, onboarding_status: String(payload.status ?? "not_started") };
    return json(res, 200, state.profileDetails);
  }
  if (url.pathname === "/__e2e/cv-failure" && req.method === "POST") {
    state.failCVPreview = Boolean(payload.enabled);
    return json(res, 200, { enabled: state.failCVPreview });
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
    return json(res, 200, { expires_in: 900, role }, { "set-cookie": [`swx_e2e_role=${encodeURIComponent(role)}; Path=/; HttpOnly; SameSite=Lax`, "sw_csrf=e2e-csrf-token; Path=/; SameSite=Lax"] });
  }
  if (url.pathname === "/api/v1/auth/refresh" && req.method === "POST") {
    const role = roleFromCookie(req);
    if (!role) return json(res, 401, { error: { message: "valid session required" } });
    return json(res, 200, { expires_in: 900, role }, { "set-cookie": [`swx_e2e_role=${encodeURIComponent(role)}; Path=/; HttpOnly; SameSite=Lax`, "sw_csrf=e2e-csrf-token; Path=/; SameSite=Lax"] });
  }
  if (url.pathname === "/api/v1/auth/logout" && req.method === "POST") return json(res, 200, {}, { "set-cookie": ["swx_e2e_role=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0", "sw_csrf=; Path=/; SameSite=Lax; Max-Age=0"] });
  if (url.pathname === "/api/v1/auth/me" && req.method === "GET") {
    const role = roleFromCookie(req);
    if (!role) return json(res, 401, { error: { message: "authentication required" } });
    const id = role === "candidate" ? candidateID : role === "recruiter" ? recruiterID : adminID;
    return json(res, 200, { id, role, first_name: role === "candidate" ? state.profile.full_name.split(" ")[0] : "", last_name: "", headline: "" });
  }

  if (url.pathname === "/api/v1/candidate/dashboard" && req.method === "GET") return json(res, 200, {
    profile: state.profile, application_count: 1, interview_count: 1, offer_count: 0, saved_count: 0,
    recommended_jobs: [job({ title: "Clinical Operations Coordinator" })],
    recent_applications: [{ id: "70000000-0000-4000-8000-000000000001", job_title: "P3 Synthetic Acceptance Engineer 1791099167", company_name: "Northstar Product Labs", stage: "withdrawn" }],
    notifications: state.candidateNotifications,
  });
  if (url.pathname === "/api/v1/candidate/profile" && req.method === "GET") return json(res, 200, state.profile);
  if (url.pathname === "/api/v1/candidate/profile" && req.method === "PATCH") {
    state.profile = { ...state.profile, ...payload, profile_completion: 82 };
    return json(res, 200, state.profile);
  }
  if (url.pathname === "/api/v1/candidate/profile/details" && req.method === "GET") return json(res, 200, state.profileDetails);
  if (url.pathname === "/api/v1/candidate/profile/details" && req.method === "PATCH") {
    const current = state.profileDetails.details;
    const details = payload.details ? { ...payload.details } : { ...current };
    for (const key of ["onboarding_status", "onboarding_method", "onboarding_return_to", "discoverable_to_recruiters"]) {
      if (key in current) details[key] = current[key];
      else delete details[key];
    }
    state.profileDetails = { ...state.profileDetails, ...payload, details, profile_updated_at: now() };
    return json(res, 200, state.profileDetails);
  }
  if (url.pathname === "/api/v1/candidate/onboarding" && req.method === "PATCH") {
    const status = String(payload.status ?? "");
    if (!["manual_started", "cv_started", "review_required", "profile_ready"].includes(status)) return json(res, 409, { error: { message: "invalid transition" } });
    const method = status === "manual_started" ? "manual" : ["cv_started", "review_required"].includes(status) ? "cv" : state.profileDetails.details.onboarding_method;
    state.profileDetails.details = { ...state.profileDetails.details, onboarding_status: status, onboarding_method: method, ...(payload.return_to ? { onboarding_return_to: payload.return_to } : {}) };
    return json(res, 200, state.profileDetails);
  }
  if (url.pathname === "/api/v1/candidate/profile/summary" && req.method === "GET") return json(res, 200, profileSummary());
  if (url.pathname === "/api/v1/candidate/profile/discovery" && req.method === "PATCH") {
    state.profileDetails.details = { ...state.profileDetails.details, discoverable_to_recruiters: Boolean(payload.enabled) };
    return json(res, 200, { discoverable_to_recruiters: Boolean(payload.enabled) });
  }
  if (url.pathname === "/api/v1/candidate/cv/parse-preview" && req.method === "POST" && state.failCVPreview) return json(res, 422, { error: { message: "unable to read document" } });
  if (url.pathname === "/api/v1/candidate/cv/parse-preview" && req.method === "POST") return json(res, 200, {
    format: "DOCX",
    fields: {
      full_name: { value: "Mira Synthetic", confidence: "review", evidence: "Mira Synthetic", requires_review: true },
      headline: { value: "Go Engineer", confidence: "review", evidence: "Go Engineer", requires_review: true },
      current_city: { value: "Pune", confidence: "review", evidence: "Location: Pune", requires_review: true },
      current_state: { value: "Maharashtra", confidence: "review", evidence: "Location: Pune, Maharashtra", requires_review: true },
      professional_summary: { value: "Builds reliable hiring tools.", confidence: "review", evidence: "Builds reliable hiring tools.", requires_review: true },
      total_experience_months: { value: "48", confidence: "review", evidence: "Supported employment dates", requires_review: true },
      email: { value: "mira@example.test", confidence: "high", evidence: "mira@example.test", requires_review: true },
    },
    skills: [{ value: "Go", confidence: "review", evidence: "Go", requires_review: true }],
    employment: [{ role: "Platform Engineer", company: "Example Labs", start: "Jan 2022", end: "Present", evidence: "synthetic" }],
    education: [{ degree: "B.E. Computer Science", institution: "Example University", year: "2020", evidence: "synthetic" }],
    links: ["https://github.com/example"],
    warnings: [],
  });
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
  if (url.pathname === "/api/v1/workforce/taxonomy/suggest" && req.method === "GET") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const items = q.includes("icu")
      ? [{ id: "11111111-1111-4111-8111-111111111111", entity_type: "competency", canonical_name: "Critical Care Nursing", matched_value: "ICU Nursing", match_kind: "alias", confidence: 1 }]
      : q.includes("reactjs")
        ? [{ id: "22222222-2222-4222-8222-222222222222", entity_type: "competency", canonical_name: "React", matched_value: "ReactJS", match_kind: "alias", confidence: 1 }]
        : q.includes("a/p")
          ? [{ id: "33333333-3333-4333-8333-333333333333", entity_type: "competency", canonical_name: "Accounts Payable", matched_value: "A/P", match_kind: "alias", confidence: 1 }]
          : [];
    return json(res, 200, { items });
  }
  if (url.pathname === "/api/v1/candidate/recommendations" && req.method === "GET") return json(res, 200, { items: [], minimum_match: 65 });
  if (url.pathname === "/api/v1/candidate/saved-jobs" && req.method === "GET") return json(res, 200, { items: [] });
  if (url.pathname === "/api/v1/candidate/jobs" && req.method === "GET") {
    const page = Number(url.searchParams.get("page") ?? 1);
    const query = url.searchParams.get("q") ?? "";
    const competency = url.searchParams.get("competency") ?? "";
    const healthcare = query.toLowerCase().includes("icu");
    const items = Array.from({ length: 10 }, (_, i) => job({
      id: `${jobID.slice(0, -2)}${String(i + 1).padStart(2, "0")}`,
      job_reference: `SWX-JOB-2026-${String(i + 1).padStart(5, "0")}`,
      title: i === 0 ? (healthcare ? "Critical Care Nurse" : "Senior Go Platform Engineer") : (healthcare ? `Registered Nurse ${i + 1}` : `Platform Engineer ${i + 1}`),
      department: healthcare ? "Critical Care" : "Engineering",
      required_skills: healthcare ? ["Critical Care Nursing", "Patient Assessment", "Clinical Documentation"] : ["Go", "PostgreSQL", "AWS"],
    }));
    const query_interpretation = query.toLowerCase() === "icu nursing"
      ? { input: query, canonical: "Critical Care Nursing", entity_type: "competency" }
      : undefined;
    const competency_interpretation = competency.toLowerCase() === "icu nursing"
      ? { input: competency, canonical: "Critical Care Nursing", entity_type: "competency" }
      : undefined;
    return json(res, 200, {
      items,
      page,
      limit: 10,
      total: 24,
      sort: url.searchParams.get("sort") || (query || competency ? "relevance" : "newest"),
      ...(query_interpretation ? { query_interpretation } : {}),
      ...(competency_interpretation ? { competency_interpretation } : {}),
    });
  }

  if (url.pathname === `/api/v1/jobs/${jobID}` && req.method === "GET") return json(res, 200, job({
    id: jobID,
    job_reference: "SWX-JOB-2026-00001",
    title: "Senior Go Platform Engineer",
    department: "Engineering",
    company_name: "Sapien Labs India",
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
    description: "Build recruitment infrastructure.",
    required_skills: ["Go", "PostgreSQL"],
  }));

  if (url.pathname === "/api/v1/recruiter/team" && req.method === "GET") return json(res, 200, { items: [
    { user_id: recruiterID, full_name: "Riya Recruiter", designation: "Senior Recruiter" },
    { user_id: "20000000-0000-4000-8000-000000000002", full_name: "Kabir Recruiter", designation: "Healthcare Recruiter" },
  ] });
  if (url.pathname === "/api/v1/recruiter/jobs/bulk" && req.method === "POST") {
    const ids = Array.from(new Set(Array.isArray(payload.job_ids) ? payload.job_ids : []));
    return json(res, 200, {
      operation_id: "91000000-0000-4000-8000-000000000001",
      requested_count: Array.isArray(payload.job_ids) ? payload.job_ids.length : 0,
      unique_count: ids.length,
      succeeded_count: ids.length,
      unchanged_count: 0,
      failed_count: 0,
      status: "succeeded",
      items: ids.map((id) => ({ job_id: id, outcome: "succeeded" })),
    });
  }
  if (url.pathname === "/api/v1/recruiter/dashboard" && req.method === "GET") return json(res, 200, {
    recruiter_name: "Riya Recruiter",
    company_name: "Sapien Labs India",
    active_jobs: 12,
    applications: 1000,
    new_applications: 9,
    shortlisted: 85,
    upcoming_interviews: 14,
    upcoming_items: [],
    offers: 7,
    hires: 5,
    placement_rate: 5.8,
    recent_applications: pipelineRows().slice(0, 6),
    needs_attention: [],
  });
  if (url.pathname === "/api/v1/recruiter/jobs" && req.method === "GET") {
    const source = [{
      ...job(),
      role_category: "Technology",
      visibility: "public",
      applications: 1000,
      new_applications: 9,
      shortlisted: 1,
      interviews: 0,
      status: "active",
      application_deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
      updated_at: now(),
    }];
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    if (q === "private operations lead") {
      source.splice(0, source.length, {
        ...job({
          id: "60000000-0000-4000-8000-000000000088",
          job_reference: "SWX-JOB-2026-00088",
          title: "Private Operations Lead",
        }),
        role_category: "Operations",
        visibility: "private",
        applications: 4,
        new_applications: 1,
        shortlisted: 0,
        interviews: 0,
        status: "active",
        application_deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
        updated_at: now(),
      });
    }
    const status = url.searchParams.get("status") ?? "";
    const roleCategory = url.searchParams.get("role_category") ?? "";
    const workMode = url.searchParams.get("work_mode") ?? "";
    const employmentType = url.searchParams.get("employment_type") ?? "";
    let items = source.filter((item) =>
      (!q || `${item.job_reference} ${item.title} ${item.department} ${item.role_category} ${item.city} ${item.state}`.toLowerCase().includes(q)) &&
      (!status || item.status === status) &&
      (!roleCategory || item.role_category === roleCategory) &&
      (!workMode || item.work_mode === workMode) &&
      (!employmentType || item.employment_type === employmentType)
    );
    if (url.searchParams.get("deadline") === "soon") items = items.filter((item) => item.status === "active");
    return json(res, 200, {
      items,
      page: Number(url.searchParams.get("page") ?? 1),
      limit: Number(url.searchParams.get("limit") ?? 20),
      total: items.length,
      sort: url.searchParams.get("sort") || "updated",
      summary: { total_jobs: 1, active_jobs: 1, draft_jobs: 0, paused_jobs: 0, applications: 1000, new_applications: 9 },
    });
  }
  if (url.pathname === `/api/v1/recruiter/jobs/${jobID}` && req.method === "GET") return json(res, 200, {
    id: jobID, job_reference: "SWX-JOB-2026-00001", status: "active", title: "Senior Go Platform Engineer", department: "Engineering",
    employment_type: "full_time", work_mode: "hybrid", role_category: "Technology", location: "Mumbai, Maharashtra",
    min_experience_years: 2, max_experience_years: 6, min_salary_lakhs: 8, max_salary_lakhs: 18,
    skills: ["Go", "PostgreSQL"], description: "Build recruitment infrastructure.", responsibilities: "Own reliable services.",
    company_overview: "Sapien Labs India", why_join: "Human-centered hiring.",
    hiring_process: ["Application review", "Recruiter conversation", "Technical interview", "Final decision"],
    application_deadline: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
    education_requirements: ["B.Tech / B.E.", "MCA"],
    screening_questions: ["Are you comfortable working with Go in production?", "Can you work in a hybrid model?"],
    referral_enabled: true, visibility: "public", internal_notes: "Priority role. Review referrals within 48 hours.",
    assigned_recruiter_id: recruiterID, openings: 3,
  });
  if (url.pathname === `/api/v1/recruiter/jobs/${jobID}/history` && req.method === "GET") return json(res, 200, { items: [
    { id: "90000000-0000-4000-8000-000000000001", action: "updated", actor_user_id: recruiterID, actor_name: "Riya Recruiter", previous_state: {}, new_state: {}, changed_at: now() },
    { id: "90000000-0000-4000-8000-000000000002", action: "created_and_published", actor_user_id: recruiterID, actor_name: "Riya Recruiter", previous_state: {}, new_state: {}, changed_at: new Date(Date.now() - 86400000).toISOString() },
  ] });
  if (url.pathname === `/api/v1/recruiter/jobs/${jobID}/analytics` && req.method === "GET") {
    const today = new Date();
    return json(res, 200, {
      job_id: jobID,
      job_reference: "SWX-JOB-2026-00001",
      title: "Senior Go Platform Engineer",
      status: "active",
      openings: 3,
      published_at: new Date(Date.now() - 19 * 86400000).toISOString(),
      application_deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
      total_applications: 1000,
      hires: 2,
      remaining_openings: 1,
      fill_rate_percent: 66.7,
      days_open: 19,
      days_to_deadline: 2,
      closing_soon: true,
      overdue: false,
      time_to_first_application_hours: 2.4,
      time_to_first_shortlist_hours: 27.2,
      time_to_first_offer_hours: 96.5,
      time_to_first_hire_hours: 144.2,
      funnel: [
        { stage: "Applied", count: 1000, conversion_percent: 100 },
        { stage: "Screening", count: 640, conversion_percent: 64 },
        { stage: "Shortlisted", count: 310, conversion_percent: 31 },
        { stage: "Interview", count: 160, conversion_percent: 16 },
        { stage: "Offer", count: 42, conversion_percent: 4.2 },
        { stage: "Hired", count: 2, conversion_percent: 0.2 },
      ],
      sources: [
        { source: "direct", applications: 520, shortlisted: 180, interviews: 92, offers: 24, hires: 1, hire_conversion_percent: 0.2 },
        { source: "referral", applications: 180, shortlisted: 85, interviews: 44, offers: 13, hires: 1, hire_conversion_percent: 0.6 },
        { source: "linkedin", applications: 300, shortlisted: 45, interviews: 24, offers: 5, hires: 0, hire_conversion_percent: 0 },
      ],
      trend: Array.from({ length: 30 }, (_, index) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (29 - index));
        return { date: day.toISOString().slice(0, 10), applications: [12,18,22,15,28,35,42][index % 7] };
      }),
    });
  }
  if (url.pathname === `/api/v1/recruiter/jobs/${jobID}/duplicate` && req.method === "POST") return json(res, 201, {
    id: "60000000-0000-4000-8000-000000000099", job_reference: "SWX-JOB-2026-00099", status: "draft",
    title: "Senior Go Platform Engineer (Copy)", department: "Engineering", employment_type: "full_time", work_mode: "hybrid",
    role_category: "Technology", location: "Mumbai, Maharashtra", min_experience_years: 2, max_experience_years: 6,
    min_salary_lakhs: 8, max_salary_lakhs: 18, skills: ["Go", "PostgreSQL"], description: "Build recruitment infrastructure.",
    responsibilities: "Own reliable services.", company_overview: "Sapien Labs India", why_join: "Human-centered hiring.",
    hiring_process: ["Application review", "Recruiter conversation", "Technical interview", "Final decision"],
    application_deadline: null, education_requirements: ["B.Tech / B.E.", "MCA"], screening_questions: [],
    referral_enabled: true, visibility: "public", internal_notes: "Priority role. Review referrals within 48 hours.",
    assigned_recruiter_id: recruiterID, openings: 3,
  });
  if (url.pathname === "/api/v1/recruiter/candidates/71000000-0000-4000-8000-000000000001/match" && req.method === "GET") return json(res, 200, {
    job_id: jobID,
    job_title: "Senior Go Platform Engineer",
    score: 86.4,
    eligible: true,
    components: {
      skills: 66.7,
      experience: 100,
      location: 100,
      availability: 90,
      semantic: 75,
      matched_skills: ["go", "postgresql"],
    },
    explanation: {
      eligible: true,
      matched_skills: ["go", "postgresql"],
      experience_months: 25,
      job_min_experience_months: 24,
      location_alignment: true,
      availability_signal: 0.9,
      method: "deterministic-weighted-v1",
    },
    model_version: "1.0.0",
    model_ref: "deterministic-weighted-v1",
    generated_at: now(),
  });
  if (url.pathname === "/api/v1/recruiter/candidates/71000000-0000-4000-8000-000000000001" && req.method === "GET") return json(res, 200, {
    user_id: "71000000-0000-4000-8000-000000000001", full_name: "Candidate 001", headline: "Backend engineer", email: "private@example.test",
    saved: true, talent_pool_tags: ["Priority", "Go Platform", "Mumbai"], current_city: "Mumbai", current_state: "Maharashtra", country_code: "IN", total_experience_months: 25,
    email_verified: true, masked_phone: "••••••••••",
    profile_completion: 92, last_active_at: now(), profile_updated_at: now(), has_company_application: true, can_view_cv: true, can_view_contact: true, can_collaborate: true,
    details: {
      professional_summary: "Backend engineer focused on reliable recruitment infrastructure, data quality, and operationally simple services.",
      current_designation: "Backend Engineer", industry: "Recruitment Technology", department_role: "Engineering / Platform", preferred_locations: "Mumbai, Pune, Remote",
      employment: [{ company: "Example Systems", job_title: "Backend Engineer", employment_type: "Full time", joining_month: "Jan", joining_year: "2024", end_month: "", end_year: "", current_company: "yes", skills_used: "Go, PostgreSQL, Redis", job_profile: "Built and operated recruiter workflow services with auditability and predictable performance." }],
      it_skills: [{ name: "Go", proficiency: "Advanced" }, { name: "PostgreSQL", proficiency: "Advanced" }, { name: "Redis", proficiency: "Intermediate" }],
      education: [{ education: "B.E. Computer Engineering", university: "University of Mumbai", specialization: "Computer Engineering", grading_system: "CGPA / 10", score: "8.4", start_year: "2018", end_year: "2022" }],
      languages: [{ language: "English", proficiency: "Professional", read: "Yes", write: "Yes", speak: "Yes" }, { language: "Marathi", proficiency: "Native", read: "Yes", write: "Yes", speak: "Yes" }],
      projects: [{ title: "Candidate workflow reliability programme", description: "Reworked asynchronous recruiter workflows to improve traceability, idempotency, and recovery during partial failures across high-volume hiring operations.", role: "Backend Engineer", skills: "Go, PostgreSQL", url: "https://portfolio.example.test/projects/candidate-workflow-reliability-programme/architecture-and-results" }],
      accomplishments: [{ title: "Operational excellence recognition", issuer: "Example Systems", description: "Recognised for reducing recurring production support incidents through safer defaults and stronger automated regression coverage." }],
      professional_links: [{ label: "Engineering portfolio", type: "portfolio", url: "https://portfolio.example.test/candidate-001/backend-engineering-and-reliability" }],
    },
  });
  if (url.pathname === "/api/v1/recruiter/candidates/71000000-0000-4000-8000-000000000002" && req.method === "GET") return json(res, 200, {
    user_id: "71000000-0000-4000-8000-000000000002", full_name: "Meera Nair", headline: "Critical care nursing professional",
    saved: false, talent_pool_tags: [], current_city: "Navi Mumbai", current_state: "Maharashtra", country_code: "IN", total_experience_months: 72,
    email_verified: false,
    profile_completion: 82, last_active_at: now(), profile_updated_at: now(), has_company_application: false, can_view_cv: false, can_view_contact: false, can_collaborate: false,
    details: { professional_summary: "Critical care nursing professional focused on patient safety.", languages: [{ language: "English", proficiency: "Professional" }, { language: "Marathi", proficiency: "Native" }] },
  });
  if (url.pathname === "/api/v1/recruiter/candidates/71000000-0000-4000-8000-000000000001/activity" && req.method === "GET") return json(res, 200, { items: [
    {type:"stage",title:"Stage changed to technical interview",description:"Moved from shortlisted to technical interview",job_id:jobID,job_title:"Senior Go Platform Engineer",occurred_at:new Date(Date.now()-3600000).toISOString()},
    {type:"interview",title:"Interview scheduled",description:"Technical interview · 45 min",job_id:jobID,job_title:"Senior Go Platform Engineer",occurred_at:new Date(Date.now()-86400000).toISOString()},
    {type:"note",title:"Recruiter note added",description:"Strong backend fundamentals; validate system design depth in the next round.",job_id:jobID,job_title:"Senior Go Platform Engineer",occurred_at:new Date(Date.now()-2*86400000).toISOString()},
    {type:"application",title:"Applied to Senior Go Platform Engineer",description:"Application entered the pipeline at screening",job_id:jobID,job_title:"Senior Go Platform Engineer",occurred_at:new Date(Date.now()-5*86400000).toISOString()}
  ]});
  if (url.pathname === "/api/v1/recruiter/discover" && req.method === "GET") return json(res, 200, { items: [
    {id:"71000000-0000-4000-8000-000000000001",full_name:"Aarav Mehta",headline:"Regional operations leader",designation:"Operations Manager",current_company:"Meridian Logistics",current_city:"Mumbai",current_state:"Maharashtra",experience_months:96,notice_period_days:30,preferred_locations:"Mumbai, Pune",skills:["Operations","Vendor Management","SAP"],education:"MBA · Operations",updated_at:now()},
    {id:"71000000-0000-4000-8000-000000000002",full_name:"Meera Nair",headline:"Critical care nursing professional",designation:"Senior Staff Nurse",current_company:"Harbour Health",current_city:"Navi Mumbai",current_state:"Maharashtra",experience_months:72,notice_period_days:15,preferred_locations:"Mumbai, Navi Mumbai",skills:["Critical Care","BLS","Patient Safety"],education:"B.Sc Nursing",updated_at:now()},
    {id:"71000000-0000-4000-8000-000000000003",full_name:"Kabir Singh",headline:"B2B relationship and branch sales",designation:"Relationship Manager",current_company:"Unity Finance",current_city:"Pune",current_state:"Maharashtra",experience_months:60,notice_period_days:0,preferred_locations:"Pune, Mumbai",skills:["B2B Sales","CRM","Portfolio Management"],education:"B.Com · Finance",updated_at:now()}
  ], page: 1, limit: 12, total: 3 });
  if (url.pathname === "/api/v1/recruiter/saved-searches" && req.method === "GET") return json(res, 200, {items:[{id:"saved-1",name:"Mumbai operations",filters:{industry:"Logistics",location:"Mumbai"},alert_enabled:true,alert_frequency:"daily",updated_at:now()}]});
  if (url.pathname === "/api/v1/recruiter/saved-searches" && req.method === "POST") return json(res, 201, {id:"saved-new",name:payload.name,filters:payload.filters,updated_at:now()});
  if (/^\/api\/v1\/recruiter\/saved-searches\/[^/]+$/.test(url.pathname) && req.method === "PATCH") return json(res, 200, {id:url.pathname.split("/").at(-1),name:"Mumbai operations",filters:{industry:"Logistics",location:"Mumbai"},alert_enabled:Boolean(payload.enabled),alert_frequency:String(payload.frequency||"daily"),updated_at:now()});
  if (url.pathname === "/api/v1/recruiter/offers" && req.method === "GET") return json(res, 200, {items:[{id:"of-1",application_id:"70000000-0000-4000-8000-000000000001",candidate_id:"71000000-0000-4000-8000-000000000001",candidate_name:"Aarav Mehta",job_id:jobID,job_title:"Senior Go Platform Engineer",job_reference:"SWX-JOB-2026-00001",title:"Employment offer",currency:"INR",annual_compensation:1800000,joining_date:"2026-11-15",expires_at:"2026-10-20",status:"sent",updated_at:now()}]});
  if (url.pathname === "/api/v1/recruiter/offers" && req.method === "POST") return json(res, 201, {id:"of-new",application_id:String(payload.application_id||""),candidate_name:"Aarav Mehta",job_title:"Senior Go Platform Engineer",job_reference:"SWX-JOB-2026-00001",title:String(payload.title||"Employment offer"),currency:String(payload.currency||"INR"),annual_compensation:payload.annual_compensation,status:"draft",updated_at:now()});
  if (/^\/api\/v1\/recruiter\/offers\/[^/]+$/.test(url.pathname) && req.method === "PATCH") return noContent(res);
  if (url.pathname === "/api/v1/recruiter/referrals" && req.method === "GET") return json(res, 200, {items:[{id:"ref-1",candidate_id:"71000000-0000-4000-8000-000000000002",candidate_name:"Meera Nair",job_id:jobID,job_title:"Senior Go Platform Engineer",referrer_name:"Nisha Rao",referrer_email:"nisha@example.test",source:"employee",status:"contacted",reward_status:"pending",updated_at:now()}]});
  if (url.pathname === "/api/v1/recruiter/referrals" && req.method === "POST") return json(res, 201, {id:"ref-new",candidate_id:String(payload.candidate_id||""),candidate_name:"Aarav Mehta",job_title:"Senior Go Platform Engineer",referrer_name:String(payload.referrer_name||""),referrer_email:String(payload.referrer_email||""),source:String(payload.source||"employee"),status:"referred",reward_status:"not_eligible",updated_at:now()});
  if (/^\/api\/v1\/recruiter\/referrals\/[^/]+$/.test(url.pathname) && req.method === "PATCH") return noContent(res);
  if (url.pathname === "/api/v1/recruiter/analytics" && req.method === "GET") return json(res, 200, {active_jobs:8,applications:186,shortlisted:62,interviews:31,offers:9,hires:6,placement_rate:3.2,source_performance:[{source:"direct",applications:92,hires:2,conversion:2.2},{source:"referral",applications:54,hires:3,conversion:5.6},{source:"linkedin",applications:40,hires:1,conversion:2.5}],monthly_trend:[{month:"2026-05",applications:22,hires:0},{month:"2026-06",applications:28,hires:1},{month:"2026-07",applications:31,hires:1},{month:"2026-08",applications:35,hires:1},{month:"2026-09",applications:33,hires:2},{month:"2026-10",applications:37,hires:1}]});
  if (url.pathname === "/api/v1/recruiter/recent-searches" && req.method === "GET") return json(res, 200, {items:[{id:1,filters:{q:"operations",location:"Mumbai"},created_at:now()}]});
  if (/^\/api\/v1\/recruiter\/talent-pool\/[^/]+$/.test(url.pathname) && req.method === "PUT") return json(res, 200, {recruiter_id:recruiterID,candidate_id:url.pathname.split("/").at(-1),tags:Array.isArray(payload.tags)?payload.tags:[],created_at:now(),updated_at:now()});
  if (/^\/api\/v1\/recruiter\/talent-pool\/[^/]+$/.test(url.pathname) && req.method === "DELETE") return noContent(res);
  if (url.pathname === "/api/v1/recruiter/talent-pool" && req.method === "GET") return json(res, 200, { items: [
    {candidate_id:"71000000-0000-4000-8000-000000000001",full_name:"Aarav Mehta",headline:"Regional operations leader",current_city:"Mumbai",experience_months:96,notice_period_days:30,tags:["Operations","Leadership"],saved_at:new Date(Date.now()-3*86400000).toISOString()},
    {candidate_id:"71000000-0000-4000-8000-000000000002",full_name:"Meera Nair",headline:"Critical care nursing professional",current_city:"Navi Mumbai",experience_months:72,notice_period_days:15,tags:["Healthcare","Critical Care"],saved_at:new Date(Date.now()-2*86400000).toISOString()},
    {candidate_id:"71000000-0000-4000-8000-000000000003",full_name:"Kabir Singh",headline:"B2B relationship and branch sales",current_city:"Pune",experience_months:60,notice_period_days:0,tags:["B2B Sales","CRM"],saved_at:new Date(Date.now()-86400000).toISOString()}
  ] });
  if (url.pathname === "/api/v1/recruiter/message-templates" && req.method === "GET") return json(res, 200, { items: state.messageTemplates });
  if (url.pathname === "/api/v1/recruiter/message-templates" && req.method === "POST") {
    const item = {
      id:`72000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12,"0")}`,
      recruiter_id:recruiterID,
      title:String(payload.title ?? ""),
      subject_template:String(payload.subject_template ?? ""),
      body_template:String(payload.body_template ?? ""),
      created_at:now(),
      updated_at:now(),
    };
    state.messageTemplates.unshift(item);
    return json(res, 201, item);
  }
  if (url.pathname === "/api/v1/recruiter/outreach/sequences" && req.method === "GET") return json(res, 200, { items: state.outreachSequences });
  if (url.pathname === "/api/v1/recruiter/outreach/sequences" && req.method === "POST") {
    const steps = Array.isArray(payload.steps) ? payload.steps : [];
    const item = {
      id:`76000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12,"0")}`,
      name:String(payload.name ?? ""),
      status:"active",
      steps:steps.map((step,index) => {
        const template=state.messageTemplates.find((candidate)=>candidate.id===step.template_id);
        return {
          id:`76100000-0000-4000-8000-${String(Date.now()+index).slice(-12).padStart(12,"0")}`,
          step_order:index+1,
          delay_hours:Number(step.delay_hours ?? 0),
          template_id:String(step.template_id ?? ""),
          title:template?.title ?? "Template",
          subject_template:template?.subject_template ?? "",
          body_template:template?.body_template ?? "",
        };
      }),
      created_at:now(),
      updated_at:now(),
    };
    state.outreachSequences.unshift(item);
    return json(res, 201, item);
  }
  if (url.pathname === "/api/v1/recruiter/outreach/campaigns" && req.method === "GET") return json(res, 200, { items: state.outreachCampaigns });
  if (url.pathname === "/api/v1/recruiter/outreach/campaigns" && req.method === "POST") {
    const sequence=state.outreachSequences.find((candidate)=>candidate.id===payload.sequence_id);
    const selectedJob=String(payload.job_id ?? "");
    const item={
      id:`77000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12,"0")}`,
      name:String(payload.name ?? ""),
      sequence_id:String(payload.sequence_id ?? ""),
      sequence_name:sequence?.name ?? "Sequence",
      job_id:selectedJob || undefined,
      job_title:selectedJob ? "Senior Go Platform Engineer" : undefined,
      status:"draft",
      total_recipients:Array.isArray(payload.candidate_ids) ? payload.candidate_ids.length : 0,
      sent_count:0,
      skipped_count:0,
      failed_count:0,
      created_at:now(),
      updated_at:now(),
    };
    state.outreachCampaigns.unshift(item);
    return json(res, 201, item);
  }
  const outreachLaunchMatch=url.pathname.match(/^\/api\/v1\/recruiter\/outreach\/campaigns\/([^/]+)\/launch$/);
  if (outreachLaunchMatch && req.method === "POST") {
    if (!req.headers["x-idempotency-key"]) return json(res, 400, {error:{code:"invalid_request",message:"messaging input is invalid"}});
    const item=state.outreachCampaigns.find((candidate)=>candidate.id===outreachLaunchMatch[1]);
    if (!item) return json(res,404,{error:{code:"not_found",message:"messaging resource was not found"}});
    item.status="running";
    item.sent_count=item.total_recipients;
    item.launched_at=now();
    item.updated_at=now();
    return json(res,200,{campaign:item,delivery:{requested_count:item.total_recipients,recipient_count:item.total_recipients,sent_count:item.total_recipients,skipped_count:0,skipped_candidate_ids:[],cooldown_days:14,status:"sent"}});
  }
  const outreachCampaignMatch=url.pathname.match(/^\/api\/v1\/recruiter\/outreach\/campaigns\/([^/]+)$/);
  if (outreachCampaignMatch && req.method === "PATCH") {
    const item=state.outreachCampaigns.find((candidate)=>candidate.id===outreachCampaignMatch[1]);
    if (!item) return json(res,404,{error:{code:"not_found",message:"messaging resource was not found"}});
    item.status=String(payload.status ?? item.status);
    item.updated_at=now();
    if (item.status==="cancelled") item.completed_at=now();
    return json(res,200,item);
  }
  if (url.pathname === "/api/v1/recruiter/inmail/bulk" && req.method === "POST") {
    const ids = Array.isArray(payload.candidate_ids) ? Array.from(new Set(payload.candidate_ids)) : [];
    if (!req.headers["x-idempotency-key"]) return json(res, 400, { error: { code: "invalid_request", message: "messaging input is invalid" } });
    return json(res, 200, {
      requested_count: ids.length,
      recipient_count: ids.length,
      sent_count: ids.length,
      skipped_count: 0,
      skipped_candidate_ids: [],
      cooldown_days: 14,
      status: "sent",
    });
  }
  if (url.pathname === "/api/v1/messaging/threads" && req.method === "GET") {
    const role = roleFromCookie(req);
    const items = state.messagingThreads.map((thread) => ({
      id: thread.id,
      recruiter_id: thread.recruiter_id,
      candidate_id: thread.candidate_id,
      job_id: thread.job_id,
      subject: thread.subject,
      status: thread.status,
      counterparty_name: role === "candidate" ? thread.recruiter_name : thread.candidate_name,
      job_title: thread.job_title,
      last_message: thread.last_message,
      unread_count: role === "candidate" ? thread.unread_candidate : thread.unread_recruiter,
      created_at: thread.created_at,
      updated_at: thread.updated_at,
    })).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
    return json(res, 200, { items });
  }
  const messagingMessagesMatch = url.pathname.match(/^\/api\/v1\/messaging\/threads\/([^/]+)\/messages$/);
  if (messagingMessagesMatch && req.method === "GET") {
    return json(res, 200, { items: state.messagingMessages[messagingMessagesMatch[1]] ?? [] });
  }
  if (messagingMessagesMatch && req.method === "POST") {
    const threadID = messagingMessagesMatch[1];
    const role = roleFromCookie(req);
    const senderID = role === "candidate" ? candidateID : recruiterID;
    const message = {
      id: `74000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12,"0")}`,
      thread_id: threadID,
      sender_id: senderID,
      sender_type: role,
      content: String(payload.content ?? "").trim(),
      is_read: false,
      created_at: now(),
    };
    if (!message.content) return json(res, 400, { error: { message: "messaging input is invalid" } });
    state.messagingMessages[threadID] = [...(state.messagingMessages[threadID] ?? []), message];
    const thread = state.messagingThreads.find((item) => item.id === threadID);
    if (thread) {
      thread.last_message = message.content;
      thread.updated_at = message.created_at;
      if (role === "candidate") thread.unread_recruiter += 1;
      else {
        thread.unread_candidate += 1;
        state.candidateNotifications.unshift({
          id:`75000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12,"0")}`,
          kind:"inmail",
          title:"New message from a recruiter",
          body:thread.subject,
          action_url:`/candidate/inbox?thread=${thread.id}`,
          read_at:null,
          created_at:message.created_at,
        });
      }
    }
    return json(res, 201, message);
  }
  const messagingReadMatch = url.pathname.match(/^\/api\/v1\/messaging\/threads\/([^/]+)\/read$/);
  if (messagingReadMatch && req.method === "PATCH") {
    const role = roleFromCookie(req);
    const thread = state.messagingThreads.find((item) => item.id === messagingReadMatch[1]);
    if (thread) {
      if (role === "candidate") thread.unread_candidate = 0;
      if (role === "recruiter") thread.unread_recruiter = 0;
    }
    return noContent(res);
  }
  if (url.pathname === "/api/v1/candidate/notifications" && req.method === "GET") return json(res, 200, { items: state.candidateNotifications });
  const notificationReadMatch = url.pathname.match(/^\/api\/v1\/candidate\/notifications\/([^/]+)\/read$/);
  if (notificationReadMatch && req.method === "PATCH") {
    const item = state.candidateNotifications.find((notification) => notification.id === notificationReadMatch[1]);
    if (item) item.read_at = now();
    return noContent(res);
  }
  if (url.pathname === "/api/v1/recruiter/interviews" && req.method === "GET") return json(res, 200, { items: [{
    id: "80000000-0000-4000-8000-000000000001", application_id: "70000000-0000-4000-8000-000000000001",
    candidate_id: "71000000-0000-4000-8000-000000000001", job_id: jobID, job_reference: "SWX-JOB-2026-00001",
    candidate_name: "Candidate 001", candidate_headline: "Backend engineer", job_title: "Senior Go Platform Engineer",
    scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(), duration_minutes: 45,
    meeting_url: "https://example.test/meeting", status: "scheduled", round_label: "Technical interview", notes: "",
  }] });
  if (/^\/api\/v1\/recruiter\/interviews\/[^/]+\/history$/.test(url.pathname) && req.method === "GET") return json(res, 200, { items: [] });
  if (url.pathname === "/api/v1/recruiter/pipeline" && req.method === "GET") {
    const page = Number(url.searchParams.get("page") ?? 1);
    let items = pipelineRows();
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const stages = url.searchParams.getAll("stage");
    const location = (url.searchParams.get("location") ?? "").toLowerCase();
    const jobFilter = url.searchParams.get("job_id") ?? "";
    const company = (url.searchParams.get("current_company") ?? "").toLowerCase();
    if (q) items = items.filter((row) => `${row.candidate_name} ${row.headline} ${row.designation} ${row.job_title} ${row.key_skills}`.toLowerCase().includes(q));
    if (stages.length) items = items.filter((row) => stages.includes(row.stage));
    if (location) items = items.filter((row) => `${row.city} ${row.preferred_location}`.toLowerCase().includes(location));
    if (jobFilter) items = items.filter((row) => row.job_id === jobFilter);
    if (company) items = items.filter((row) => row.current_company.toLowerCase().includes(company));
    return json(res, 200, { items, page, limit: 10, total: q || stages.length || location || company ? items.length : 1000 });
  }
  const stageMatch = url.pathname.match(/^\/api\/v1\/recruiter\/applications\/([^/]+)\/stage$/);
  if (stageMatch && req.method === "PATCH") {
    state.stages.set(stageMatch[1], String(payload.stage ?? "new_application"));
    return json(res, 200, { updated: true });
  }

  if (url.pathname === "/api/v1/admin/privacy/requests" && req.method === "GET") {
    if (roleFromCookie(req) !== "master_admin") return json(res, 403, { error: { message: "administrator access denied" } });
    return json(res, 200, { items: [
      { id: "e1000000-0000-4000-8000-000000000001", user_id: candidateID, request_type: "export", status: "in_progress", due_at: new Date(Date.now()+14*86400000).toISOString(), created_at: now() },
      { id: "e1000000-0000-4000-8000-000000000002", user_id: recruiterID, request_type: "erasure", status: "awaiting_review", due_at: new Date(Date.now()+21*86400000).toISOString(), created_at: now() },
    ] });
  }
  if (url.pathname === "/api/v1/admin/privacy/incidents" && req.method === "GET") {
    if (roleFromCookie(req) !== "master_admin") return json(res, 403, { error: { message: "administrator access denied" } });
    return json(res, 200, { items: [
      { id: "e2000000-0000-4000-8000-000000000001", title: "Synthetic incident readiness exercise", severity: "medium", status: "investigating", discovered_at: now(), notification_required: false },
    ] });
  }
  if (url.pathname === "/api/v1/admin/privacy/processing-activities" && req.method === "GET") {
    if (roleFromCookie(req) !== "master_admin") return json(res, 403, { error: { message: "administrator access denied" } });
    return json(res, 200, { items: [
      { id: "e3000000-0000-4000-8000-000000000001", activity_name: "Recruitment profile operations", purpose: "Operate candidate profiles and hiring workflows.", lawful_basis: "contract", retention_policy: "Account lifecycle plus approved retention window", owner: "Privacy Operations", reviewed_at: now() },
      { id: "e3000000-0000-4000-8000-000000000002", activity_name: "Recruiter discovery consent", purpose: "Enable opt-in pre-application discovery and outreach.", lawful_basis: "consent", retention_policy: "Until consent withdrawal or account closure", owner: "Privacy Operations", reviewed_at: now() },
    ] });
  }
  if (url.pathname === "/api/v1/admin/privacy/subprocessors" && req.method === "GET") {
    if (roleFromCookie(req) !== "master_admin") return json(res, 403, { error: { message: "administrator access denied" } });
    return json(res, 200, { items: [
      { id: "e4000000-0000-4000-8000-000000000001", name: "Synthetic Cloud Processor", purpose: "Private object storage and delivery", processing_locations: ["IN"], transfer_mechanism: "Not required", tia_status: "not_required", effective_from: "2026-01-01" },
      { id: "e4000000-0000-4000-8000-000000000002", name: "Synthetic Email Processor", purpose: "Transactional email delivery", processing_locations: ["IN"], transfer_mechanism: "DPA", tia_status: "approved", tia_reviewed_at: now(), effective_from: "2026-01-01" },
    ] });
  }

  if (url.pathname === "/api/v1/admin/trust/risk-flags" && req.method === "GET") {
    if (roleFromCookie(req) !== "master_admin") return json(res, 403, { error: { message: "administrator access denied" } });
    const permissions = adminCatalog[state.adminAccess.admin_role] ?? [];
    if (state.adminAccess.enabled && (!state.adminAccess.assigned || !state.adminAccess.mfa_verified || !permissions.includes("trust_risk.read"))) return json(res, 403, { error: { message: "trust risk access denied" } });
    return json(res, 200, { items: [
      { id: "d1000000-0000-4000-8000-000000000001", subject_type: "job", subject_id: jobID, risk_type: "contact_pattern_anomaly", severity: "high", status: "pending_review", source: "rules-v1", explanation: "The signal requires human review before any administrative action.", evidence: { repeated_contact_pattern: true, sample_window_days: 7 }, created_at: now() },
      { id: "d1000000-0000-4000-8000-000000000002", subject_type: "candidate", subject_id: candidateID, risk_type: "profile_consistency_review", severity: "medium", status: "reviewing", source: "rules-v1", explanation: "Profile evidence is inconsistent and should be reviewed by an authorized administrator.", evidence: { inconsistent_fields: 2 }, created_at: now() },
    ] });
  }
  const trustReview = url.pathname.match(/^\/api\/v1\/admin\/trust\/risk-flags\/([^/]+)$/);
  if (trustReview && req.method === "PATCH") {
    const permissions = adminCatalog[state.adminAccess.admin_role] ?? [];
    if (roleFromCookie(req) !== "master_admin" || (state.adminAccess.enabled && (!state.adminAccess.assigned || !state.adminAccess.mfa_verified || !permissions.includes("trust_risk.review")))) return json(res, 403, { error: { message: "trust risk review denied" } });
    return json(res, 200, { status: String(payload.status || "reviewing") });
  }
  if (url.pathname === "/api/v1/admin/intelligence" && req.method === "GET") {
    if (roleFromCookie(req) !== "master_admin") return json(res, 403, { error: { message: "administrator access denied" } });
    const permissions = adminCatalog[state.adminAccess.admin_role] ?? [];
    if (state.adminAccess.enabled && (!state.adminAccess.assigned || !state.adminAccess.mfa_verified || (!permissions.includes("intelligence.read") && !permissions.includes("intelligence.metrics.read")))) {
      return json(res, 403, { error: { message: "intelligence access denied" } });
    }
    return json(res, 200, intelligenceDashboard());
  }
  const intelligenceReview = url.pathname.match(/^\/api\/v1\/admin\/intelligence\/reviews\/([^/]+)$/);
  if (intelligenceReview && req.method === "PATCH") {
    const permissions = adminCatalog[state.adminAccess.admin_role] ?? [];
    if (roleFromCookie(req) !== "master_admin" || (state.adminAccess.enabled && (!state.adminAccess.assigned || !state.adminAccess.mfa_verified || !permissions.includes("intelligence.feedback.review")))) {
      return json(res, 403, { error: { message: "intelligence review denied" } });
    }
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
    let items = [{ id: companyID, legal_name: "Acme Hiring India Private Limited", display_name: "Acme Hiring India", work_email_domain: "acme.example.invalid", website_url: "https://acme.example.invalid", country_code: "IN", verification_status: state.verificationStatus === "approved" ? "verified" : "pending", created_at: now(), recruiters: 1, active_jobs: 1, applications: 4, cv_views_current_month: 12 }];
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
  if (url.pathname === "/api/v1/admin/email-health" && req.method === "GET") return json(res, 200, {
    enabled: false,
    provider: {},
    pending: 2,
    failed: 1,
    sent_24h: 0,
    suppressed: 2,
    bounces: 1,
    complaints: 1,
    oldest_pending_at: "2026-10-03T06:10:00Z",
    checked_at: now(),
  });

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
