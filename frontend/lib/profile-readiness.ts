import type { CandidateProfile, CandidateProfileDetails } from "./candidate";
import { profileKeySkills } from "./profile-key-skills";
export function candidateExperienceText(months: number, workStatus?: string, hasEmployment = false) {
    if (/fresher|student/i.test(workStatus || ""))
        return "Fresher";
    if (!Number.isFinite(months) || months <= 0)
        return hasEmployment ? "< 1 month" : null;
    const years = Math.floor(months / 12), remainder = months % 12;
    return [years ? years + " yr" + (years === 1 ? "" : "s") : "", remainder ? remainder + " mo" + (remainder === 1 ? "" : "s") : ""].filter(Boolean).join(" ");
}
export function profileReadiness(profile: CandidateProfile, extended: CandidateProfileDetails) {
    const details = extended.details;
    const skills = new Set([...profileKeySkills(details.key_skills), ...(details.it_skills || []).map(row => row.name || "")].filter(Boolean).map(value => value.trim().toLowerCase()));
    const items = [
        { label: "Add mobile number", href: "/candidate/settings#mobile", ready: !!profile.phone },
        { label: "Add professional headline", href: "#section-headline", ready: !!profile.headline },
        { label: "Upload your latest resume", href: "#section-resume", ready: !!extended.cv_original_filename },
        { label: "Add " + Math.max(0, 3 - skills.size) + " more skill" + (3 - skills.size === 1 ? "" : "s"), href: "#section-keyskills", ready: skills.size >= 3 },
        { label: "Add employment history", href: "#section-experience", ready: /fresher|student/i.test(details.work_status || "") || !!details.employment?.some(row => row.company && row.job_title) },
        { label: "Add education", href: "#section-education", ready: !!details.education?.some(row => row.university && (row.level || row.education)) },
        { label: "Add career preferences", href: "#section-preferences", ready: !!details.preferred_locations && profile.notice_period_days != null },
    ];
    return items.filter(item => !item.ready);
}
