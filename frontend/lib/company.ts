export type CompanyScope = {
    all: boolean;
    departments: string[];
    locations: string[];
    job_ids: string[];
};
export type CompanyMember = {
    company_id: string;
    user_id: string;
    name: string;
    email?: string;
    role: "primary_admin" | "sub_admin" | "recruiter" | "collaborator" | "legacy_recruiter";
    status: string;
    scope: CompanyScope;
    talent_seat: boolean;
};
export type CompanyProfile = {
    about: string;
    industry: string;
    size: string;
    headquarters: string;
    website: string;
    logo_url: string;
    banner_url: string;
    locations: string[];
    benefits: string[];
    culture: string;
    social_links: string[];
};
export type CompanySetup = {
    profile: CompanyProfile;
    structure: {
        departments: string[];
        locations: string[];
    };
    hiring: {
        timezone: string;
        referral_policy: string;
        interview_guidance: string;
        approval_required: boolean;
    };
    privacy: {
        notice_url: string;
        retention_days: number;
        acknowledged: boolean;
    };
    completed_steps: string[];
    completed_at?: string;
};
export type CompanyWorkspace = {
    member: CompanyMember;
    jobs: {
        id: string;
        title: string;
        department: string;
        city: string;
        status: string;
        applications: number;
    }[];
    setup?: CompanySetup;
};
export type CompanyEntitlements = {
    company_id: string;
    managed: boolean;
    state: string;
    plan_name: string;
    previous_plan?: string;
    premium_until?: string;
    period_start?: string;
    period_end?: string;
    features: Record<string, boolean>;
    capacity: Record<string, number | null>;
    usage: Record<string, number | null>;
    limits_approved: boolean;
    data_preserved: boolean;
};
export type CompanyPolicy = {
    company_id: string;
    managed: boolean;
    plan_name: string;
    state: string;
    period_start?: string;
    period_end?: string;
    grace_until?: string;
    cancel_at_end: boolean;
    features: Record<string, boolean>;
    capacity: Record<string, number | null>;
    usage: Record<string, number | null>;
    free_capacity: Record<string, number | null>;
    limits_approved: boolean;
};
export type CompanyPlan = {
    policy: CompanyPolicy;
    entitlements: CompanyEntitlements;
    usage: Record<string, number>;
    capacity_usage?: Record<string, number>;
    overrides: {
        id: string;
        key: string;
        expires_at: string;
        reason: string;
    }[];
};
export type CompanyInvitation = {
    id: string;
    email: string;
    name: string;
    role: string;
    scope: CompanyScope;
    talent_seat: boolean;
    expires_at: string;
    accepted_at?: string;
    revoked_at?: string;
};
export type PublicCompany = {
    id: string;
    name: string;
    city: string;
    country: string;
    profile: CompanyProfile;
    open_jobs: number;
    employee_count: number;
    employee_rating?: number;
    interview_count: number;
    interview_rating?: number;
};
export const companyRatingLabels = { work_culture: "Work culture", management: "Management", work_life: "Work-life balance", career_growth: "Career growth", compensation: "Compensation & benefits", job_security: "Job security", learning: "Learning & development", diversity: "Diversity & inclusion" };
export type CompanyReviewInput = {
    company_id: string;
    kind: "employee" | "interview";
    relationship: string;
    job_function: string;
    location: string;
    period_start?: string;
    period_end?: string;
    anonymous: boolean;
    overall: number;
    ratings: Record<string, number | null>;
    title: string;
    pros: string;
    cons: string;
    advice: string;
    recommend?: boolean;
    outlook: string;
    interview: {
        experience: string;
        difficulty: string;
        duration: string;
        offer: string;
        organization?: number;
        communication?: number;
    };
};
export type CompanyReview = CompanyReviewInput & {
    id: string;
    public_name: string;
    verified: boolean;
    published_at?: string;
    edited_at?: string;
    response?: string;
    helpful: number;
};
export type OwnCompanyReview = CompanyReviewInput & {
    id: string;
    display_name: string;
    moderation_status: string;
    moderation_reason?: string;
    interview_details: CompanyReviewInput["interview"];
};
export const emptySetup: CompanySetup = { profile: { about: "", industry: "", size: "", headquarters: "", website: "", logo_url: "", banner_url: "", locations: [], benefits: [], culture: "", social_links: [] }, structure: { departments: [], locations: [] }, hiring: { timezone: "Asia/Kolkata", referral_policy: "", interview_guidance: "", approval_required: false }, privacy: { notice_url: "", retention_days: 0, acknowledged: false }, completed_steps: [] };
