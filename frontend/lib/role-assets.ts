export type SapienRoleAsset =
  | "candidate"
  | "recruiter"
  | "company"
  | "consultant"
  | "job-seeker"
  | "team-member"
  | "admin";

type RoleAsset = {
  publicSrc: string | null;
  alt: string;
  authOnly?: boolean;
};

// Single source of truth for Human Signal role imagery. Public/auth surfaces may
// consume these assets; authenticated workspaces should remain product/data led.
// The admin mascot deliberately remains null until the approved admin-dog 4K
// binary is committed rather than substituting unrelated artwork.
export const ROLE_ASSETS: Record<SapienRoleAsset, RoleAsset> = {
  candidate: {
    publicSrc: "/images/people/sapien-hero-candidate.webp",
    alt: "Candidate professional portrait",
  },
  recruiter: {
    publicSrc: "/images/people/sapien-recruiter.webp",
    alt: "Recruiter professional portrait",
  },
  company: {
    publicSrc: "/images/people/sapien-employer.webp",
    alt: "Company hiring team portrait",
  },
  consultant: {
    publicSrc: "/images/people/recruiter-team.webp",
    alt: "Recruitment consultant portrait",
  },
  "job-seeker": {
    publicSrc: "/images/people/sapien-talent.webp",
    alt: "Job seeker professional portrait",
  },
  "team-member": {
    publicSrc: "/images/people/sapien-workplace.webp",
    alt: "Collaborative team member portrait",
  },
  admin: {
    publicSrc: null,
    alt: "SapienWorx admin mascot",
    authOnly: true,
  },
};
