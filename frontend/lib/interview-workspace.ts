import type { Interview } from "./recruiter";
export const interviewZones = ["Asia/Kolkata", "UTC", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"];
export function interviewDay(value: string, zone = "Asia/Kolkata") { return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
export function shiftInterviewDay(value: string, days: number) { const result = new Date(`${value}T00:00:00Z`); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0,10); }
export function interviewWeek(value: string) { return shiftInterviewDay(value, -((new Date(`${value}T00:00:00Z`).getUTCDay() + 6) % 7)); }
export function feedbackDue(item: Interview, now: number) { return !["cancelled", "no_show"].includes(item.status) && (item.status === "completed" || new Date(item.scheduled_at).getTime() + item.duration_minutes * 60000 <= now) && (item.feedback_expected || 0) > (item.feedback_submitted || 0); }
export function feedbackLabel(item: Interview, now: number) {
  const expected = item.feedback_expected || 0, count = item.feedback_submitted || 0;
  if (!expected || ["cancelled", "no_show"].includes(item.status)) return "—";
  if (count === expected) return `Complete · ${count}/${expected}`;
  if (feedbackDue(item, now)) { const hours = Math.floor((now - new Date(item.scheduled_at).getTime() - item.duration_minutes * 60000) / 3600000); return `${count}/${expected} pending${hours >= 24 ? ` · ${hours}h overdue` : ""}`; }
  return `${count}/${expected} submitted`;
}
export function interviewConflicts(items: Interview[]) {
  const conflicts = new Set<string>();
  const scheduled = items.filter(item => item.status === "scheduled").sort((a,b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  for (let a = 0; a < scheduled.length; a++) for (let b = a + 1; b < scheduled.length; b++) {
    const left = scheduled[a], right = scheduled[b];
    if (Date.parse(right.scheduled_at) >= Date.parse(left.scheduled_at) + left.duration_minutes * 60000) break;
    if (left.candidate_id === right.candidate_id || left.interviewers?.some(p => p.response !== "declined" && right.interviewers?.some(q => q.user_id === p.user_id && q.response !== "declined"))) { conflicts.add(left.id); conflicts.add(right.id); }
  }
  return conflicts;
}
