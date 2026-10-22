import type { CandidateJob } from "@/lib/candidate";

const employmentTypes: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACTOR",
  contractor: "CONTRACTOR",
  temporary: "TEMPORARY",
  intern: "INTERN",
  internship: "INTERN",
  volunteer: "VOLUNTEER",
  per_diem: "PER_DIEM",
  other: "OTHER",
};

function isoDateTime(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value.length === 10 ? `${value}T23:59:59Z` : value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function jobPostingJsonLd(job: CandidateJob, canonicalUrl: string) {
  const location =
    job.work_mode === "remote"
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: {
            "@type": "Country",
            name: job.country_code,
          },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              ...(job.city ? { addressLocality: job.city } : {}),
              ...(job.state ? { addressRegion: job.state } : {}),
              addressCountry: job.country_code,
            },
          },
        };

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    url: canonicalUrl,
    identifier: {
      "@type": "PropertyValue",
      name: "SapienWorx",
      value: job.job_reference ?? job.id,
    },
    ...(isoDateTime(job.published_at) ? { datePosted: isoDateTime(job.published_at) } : {}),
    ...(isoDateTime(job.application_deadline) ? { validThrough: isoDateTime(job.application_deadline) } : {}),
    ...(employmentTypes[job.employment_type] ? { employmentType: employmentTypes[job.employment_type] } : {}),
    hiringOrganization: {
      "@type": "Organization",
      name: job.company_name,
      ...(job.company_logo_url ? { logo: job.company_logo_url } : {}),
    },
    ...(job.required_skills?.length ? { skills: job.required_skills.join(", ") } : {}),
    ...location,
  };
}
