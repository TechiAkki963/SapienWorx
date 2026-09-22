import http from "node:http";
import { URL } from "node:url";

const host = "127.0.0.1";
const port = 18080;
const webOrigin = "http://127.0.0.1:3000";

const now = () => new Date().toISOString();
function seedKnowledge() {
  const starters = [
    ["build-a-resume-that-tells-your-story", "Build a résumé that tells your story", "Resume & Profile", "/images/people/candidate-signup.webp", "Professional preparing career profile"],
    ["prepare-for-an-interview-with-confidence", "Prepare for an interview with confidence", "Interview Preparation", "/images/people/recruiter-signup.webp", "Professional reviewing interview notes"],
    ["make-a-practical-skill-growth-plan", "Make a practical skill-growth plan", "Skills & Career Growth", "/images/people/candidate-login.webp", "Professional learning career skills"],
    ["humans-and-ai-working-better-together", "Humans and AI working better together", "Humans & AI at Work", "/images/people/auth-recruiter.webp", "Professional team collaborating"],
  ];
  return starters.map(([slug,title,category,image_path,image_alt], index) => ({
    id: `90000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,
    slug,title,category,image_path,image_alt,
    excerpt: [
      "A clear, specific résumé helps a recruiter understand the work you have actually done.",
      "Prepare real examples, useful questions and a calm plan for the interview day.",
      "Turn an ambitious career goal into small, verifiable learning milestones.",
      "A practical way to use AI tools while keeping human judgment and accountability central.",
    ][index],
    body: [
      "Start with the role you want. Highlight the work you actually did, the problem and the outcome. Keep headings, dates and contact information easy to find.",
      "Review the role, prepare examples of your contributions and ask how success will be measured. Confirm the interview time and meeting details.",
      "Choose a target role, identify the most important skill gaps, build a small project and seek feedback. Track what you learned rather than collecting random courses.",
      "Use AI for clearly defined tasks, verify consequential claims and protect confidential information. Combine technical tools with human judgment and communication.",
    ][index],
    author_name: "SapienWorx Editorial", status: "published", featured_order: index+1, revision:1,
    published_at:now(),created_at:now(),updated_at:now(),
  }));
}

const candidateID = "10000000-0000-4000-8000-000000000001";
const recruiterID = "20000000-0000-4000-8000-000000000001";
const adminID = "30000000-0000-4000-8000-000000000001";
const companyID = "40000000-0000-4000-8000-000000000001";
const verificationID = "50000000-0000-4000-8000-000000000001";
const jobID = "60000000-0000-4000-8000-000000000001";

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
    knowledge: seedKnowledge(),
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
  state.requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams.entries()), search: url.search, body: payload, at: now() });
  if (state.requests.length > 300) state.requests.shift();
}

function job(overrides = {}) {
  return {
    id: jobID,
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
  if (url.pathname === "/api/v1/auth/me" && req.method === "GET") {
    const role = roleFromCookie(req);
    if (!role) return json(res, 401, { error: { message: "authentication required" } });
    const id = role === "candidate" ? candidateID : role === "recruiter" ? recruiterID : adminID;
    return json(res, 200, { id, role });
  }

  if (url.pathname === "/api/v1/knowledge" && req.method === "GET") {
    const category = url.searchParams.get("category");
    const items = state.knowledge.filter(article => article.status === "published" && (!category || article.category === category))
      .sort((a,b) => a.featured_order - b.featured_order);
    return json(res,200,{items,total:items.length});
  }
  const publicKnowledge = url.pathname.match(/^\/api\/v1\/knowledge\/([a-z0-9-]+)$/);
  if (publicKnowledge && req.method === "GET") {
    const article = state.knowledge.find(a => a.slug === publicKnowledge[1] && a.status === "published");
    return article ? json(res,200,article) : json(res,404,{error:{message:"Article not found"}});
  }
  if (url.pathname === "/api/v1/admin/knowledge" || url.pathname.startsWith("/api/v1/admin/knowledge/")) {
    if (roleFromCookie(req) !== "master_admin") return json(res,403,{error:{message:"Admin access denied"}});
    if (url.pathname === "/api/v1/admin/knowledge" && req.method === "GET") {
      return json(res,200,{items:[...state.knowledge].sort((a,b)=>b.updated_at.localeCompare(a.updated_at)),total:state.knowledge.length});
    }
    if (url.pathname === "/api/v1/admin/knowledge" && req.method === "POST") {
      const article = {...payload,id:`90000000-0000-4000-8000-${String(state.knowledge.length+1).padStart(12,"0")}`,revision:1,
        published_at:payload.status === "published" ? now() : null,created_at:now(),updated_at:now()};
      if (state.knowledge.some(a=>a.slug===article.slug)) return json(res,400,{error:{message:"Slug already exists"}});
      state.knowledge.unshift(article);
      return json(res,201,article);
    }
    const match = url.pathname.match(/^\/api\/v1\/admin\/knowledge\/([^/]+)$/);
    if (match && req.method === "PUT") {
      const article = state.knowledge.find(a=>a.id===match[1]);
      if (!article) return json(res,404,{error:{message:"Article not found"}});
      if (article.revision !== payload.revision) return json(res,409,{error:{message:"This article changed; reload before saving"}});
      const next = {...article,...payload,revision:article.revision+1,updated_at:now(),
        published_at:payload.status === "published" ? (article.published_at ?? now()) : null};
      Object.assign(article,next);
      return json(res,200,article);
    }
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

  if (url.pathname === "/api/v1/admin/metrics" && req.method === "GET") return json(res, 200, {
    metric_date: now().slice(0, 10), total_active_users: 12540, active_jobs: 321, total_candidates: 11800,
    jobs_posted_today: 42, sns_sms_sent_today: 18, sns_sms_sent_billing_cycle: 430,
    sns_billing_cycle_start: new Date(Date.now() - 10 * 86400000).toISOString(), pending_company_reviews: state.verificationStatus === "pending" ? 1 : 0, computed_at: now(),
  });
  if (url.pathname === "/api/v1/admin/company-verifications" && req.method === "GET") {
    const requested = url.searchParams.get("status") ?? "pending";
    const item = { id: verificationID, company_id: companyID, recruiter_user_id: recruiterID, company_name: "Acme Hiring India", registration_doc_url: "s3://private-bucket/acme.pdf", status: state.verificationStatus, created_at: now(), updated_at: now() };
    const items = requested === state.verificationStatus ? [item] : [];
    return json(res, 200, { items, page: 1, limit: Number(url.searchParams.get("limit") ?? 25), total: items.length });
  }
  const approveMatch = url.pathname.match(/^\/api\/v1\/admin\/company-verifications\/([^/]+)\/approve$/);
  if (approveMatch && req.method === "POST") {
    state.verificationStatus = "approved";
    return json(res, 200, { approved: true });
  }

  return json(res, 404, { error: { message: `No E2E mock for ${req.method} ${url.pathname}` } });
});

server.listen(port, host, () => console.log(`SapienWorx E2E mock API on http://${host}:${port}`));
