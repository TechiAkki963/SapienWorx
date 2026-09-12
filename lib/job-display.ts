const jobLabels: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
  FREELANCE: "Freelance",
  ON_SITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

export function jobLabel(value: string | null | undefined) {
  if (!value) return "Not specified";
  return jobLabels[value] ?? value.replace(/_/g, " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

/** Removes a duplicated workplace suffix from legacy location values. */
export function jobLocation(location: string | null | undefined, workplaceModel: string | null | undefined) {
  const original = location?.trim() || "Location flexible";
  if (!workplaceModel) return original;
  const workplace = jobLabel(workplaceModel).toLowerCase();
  const parts = original.split("·").map((part) => part.trim()).filter(Boolean).filter((part) => part.toLowerCase() !== workplace);
  return parts.join(" · ") || original;
}
