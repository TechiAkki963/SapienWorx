export type JDInformationSource = "recruiter_supplied" | "sapienworx_suggested" | "ai_suggested";
export type JDSourcedValue = { id: string; value: string; source: JDInformationSource; source_reference: string; requires_confirmation: boolean; edited_by_recruiter?: boolean };
export type JDSuggestionKind = "responsibilities" | "required_skills" | "preferred_skills" | "qualifications";
export type JobDescriptionDraft = {
 version: "v1.1"; blueprint_version: string; blueprint_hash: string;
 headline: JDSourcedValue; about_role: JDSourcedValue;
 responsibilities: JDSourcedValue[]; required_skills: JDSourcedValue[]; preferred_skills: JDSourcedValue[]; qualifications: JDSourcedValue[];
 location: JDSourcedValue; experience: { minimum: number; maximum: number; source: JDInformationSource; source_reference: string };
 assumptions_requiring_review: JDSourcedValue[];
};

// Local rendering of a private proposal after Edit/Remove. It never calls a
// provider, parses prose or changes the authoritative job-builder fields.
export function renderJDGenerationDraft(draft: JobDescriptionDraft, supplied: { work_mode?: string; employment_type?: string; company_overview?: string; why_join?: string }) {
 const parts = [draft.headline.value, `About the Role\n${draft.about_role.value}`];
 const section = (heading: string, items: JDSourcedValue[]) => { if (items.length) parts.push(`${heading}\n${items.map(item => `- ${item.value}`).join("\n")}`); };
 section("Key Responsibilities — role recommendations for review", draft.responsibilities);
 section("Skills / Competencies — recruiter confirmed", draft.required_skills.filter(item => item.source === "recruiter_supplied"));
 section("Skills / Competencies — core recommendations, not confirmed requirements", draft.required_skills.filter(item => item.source !== "recruiter_supplied"));
 section("Preferred Skills — optional recommendations for review", draft.preferred_skills);
 section("Qualifications — recruiter supplied", draft.qualifications);
 parts.push(`Experience\n${draft.experience.minimum}–${draft.experience.maximum} years`);
 parts.push(`Location\n${draft.location.value}${supplied.work_mode ? ` · ${supplied.work_mode.replaceAll("_", " ")}` : ""}`);
 if (supplied.employment_type) parts.push(`Employment Type\n${supplied.employment_type.replaceAll("_", " ")}`);
 if (supplied.company_overview) parts.push(`About the Company\n${supplied.company_overview}`);
 if (supplied.why_join) parts.push(`Why Join\n${supplied.why_join}`);
 return parts.join("\n\n");
}
