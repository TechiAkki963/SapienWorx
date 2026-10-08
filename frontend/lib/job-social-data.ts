import type { CandidateJob } from "@/lib/candidate";
import { experienceLabel, humanize, jobLocation } from "@/lib/candidate";

function text(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum) : "";
}

export function jobSocialData(job: CandidateJob) {
  const title = text(job.title, 180) || "SapienWorx Jobs";
  const company = text(job.company_name, 100);
  const location = text(jobLocation({ ...job, work_mode: job.work_mode || "", country_code: job.country_code || "" }), 100);
  const workMode = job.work_mode ? text(humanize(job.work_mode), 40) : "";
  const experience = Number.isFinite(job.min_experience_months) ? experienceLabel(job) : "";
  const skills = [...new Set((Array.isArray(job.required_skills) ? job.required_skills : []).map(skill => text(skill, 40)).filter(Boolean))].slice(0, 4);
  const details = [...new Set([location, workMode, experience].filter(Boolean))];
  const heading = company ? `${title} at ${company}` : title;
  const description = [...details, skills.join(", ")].filter(Boolean).join(" · ") || "Find your next opportunity and apply on SapienWorx.";
  return {
    title, company, location, workMode, experience, skills, details, heading, description,
    pageDescription: `Apply for ${heading}${location ? ` in ${location}` : ""}. ${[experience, skills.join(", ")].filter(Boolean).join(" · ") || "Explore this opportunity on SapienWorx."}`,
    initials: company.split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join("").toUpperCase() || "S",
  };
}
