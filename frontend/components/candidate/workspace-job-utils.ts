const stages: Record<string, string> = {
  new_application: "Applied",
  screening: "Screening",
  shortlisted: "Shortlisted",
  technical_interview: "Technical interview",
  hr_round: "HR interview",
  final_interview: "Final interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function candidateStageLabel(stage: string) {
  return stages[stage] ?? "Status update";
}
export function candidateDate(
  value: string,
  includeTime = false,
  timeZone = "Asia/Kolkata",
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString("en-IN", {
    timeZone,
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  });
}
export function safeMeetingURL(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
