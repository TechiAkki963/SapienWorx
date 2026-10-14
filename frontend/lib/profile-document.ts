import type { CandidateProfileSummary, CandidateProfileDetails } from "./candidate";
import { profileKeySkills } from "./profile-key-skills";
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
/** An accessible professional-only HTML export, with no contact/compensation/session data. */
export function professionalProfileDocument(identity: CandidateProfileSummary, details: CandidateProfileDetails) {
    const employment = (details.details.employment || []).map(row => '<li><strong>' + escape(row.job_title) + '</strong> · ' + escape(row.company) + '</li>').join("");
    const education = (details.details.education || []).map(row => '<li>' + escape(row.course || row.education || row.level) + ' · ' + escape(row.university) + '</li>').join("");
    const skills = profileKeySkills(details.details.key_skills).map(escape).join(" · ");
    return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escape(identity.full_name) + ' — SapienWorx profile</title><style>body{font:16px/1.7 system-ui;margin:40px auto;padding:0 24px;max-width:800px;color:#102342}h1{line-height:1.2}h2{border-top:1px solid #dbe3ef;padding-top:20px}.brand{color:#0866ff}</style><main><p class="brand">SapienWorx</p><h1>' + escape(identity.full_name) + '</h1><p>' + escape(identity.headline) + '</p><p>' + escape(identity.current_location) + '</p><h2>Professional summary</h2><p>' + escape(details.details.professional_summary) + '</p><h2>Skills</h2><p>' + skills + '</p><h2>Experience</h2><ul>' + employment + '</ul><h2>Education</h2><ul>' + education + '</ul></main></html>';
}
