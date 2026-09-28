import Link from "next/link";

import { Interview } from "@/lib/recruiter";

type Mode = "day" | "week";
const dayKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
const timeFormat = new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: "Asia/Kolkata" });
function isoDay(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : dayKey(new Date()); }
function shiftDay(value: string, days: number) { const result = new Date(`${value}T00:00:00Z`); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0, 10); }
function weekStart(value: string) { const weekday = new Date(`${value}T00:00:00Z`).getUTCDay(); return shiftDay(value, -((weekday + 6) % 7)); }
function href(mode: Mode, date: string) { return `/recruiter/interviews?view=calendar&mode=${mode}&date=${date}`; }
function dateLabel(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }

export function InterviewCalendar({ items, mode, date }: { items: Interview[]; mode: Mode; date?: string }) {
  const today = dayKey(new Date());
  const selected = isoDay(date);
  const start = mode === "week" ? weekStart(selected) : selected;
  const days = Array.from({ length: mode === "week" ? 7 : 1 }, (_, index) => shiftDay(start, index));
  const scheduled = items.filter((item) => item.status === "scheduled");

  return <section aria-label="Interview calendar" className="grid min-w-0 gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3">
      <div className="flex gap-2"><Link href={href("day", selected)} aria-current={mode === "day" ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === "day" ? "bg-indigo-soft text-indigo" : "text-ink-muted"}`}>Day</Link><Link href={href("week", selected)} aria-current={mode === "week" ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === "week" ? "bg-indigo-soft text-indigo" : "text-ink-muted"}`}>Week</Link></div>
      <p className="text-sm font-bold text-navy">{dateLabel(start)}{mode === "week" && ` – ${dateLabel(days[6])}`}</p>
      <div className="flex gap-2"><Link aria-label={`Previous ${mode}`} href={href(mode, shiftDay(selected, mode === "week" ? -7 : -1))} className="rounded-lg border border-line px-3 py-2 text-sm font-bold text-indigo">←</Link><Link href={href(mode, today)} className="rounded-lg border border-line px-3 py-2 text-sm font-bold text-indigo">Today</Link><Link aria-label={`Next ${mode}`} href={href(mode, shiftDay(selected, mode === "week" ? 7 : 1))} className="rounded-lg border border-line px-3 py-2 text-sm font-bold text-indigo">→</Link></div>
    </div>
    <div className={`grid min-w-0 gap-3 ${mode === "week" ? "md:grid-cols-2 2xl:grid-cols-7" : "max-w-3xl"}`}>
      {days.map((day) => { const dayItems = scheduled.filter((item) => dayKey(new Date(item.scheduled_at)) === day); return <div key={day} className="min-w-0 rounded-2xl border border-line/70 bg-slate-50/70 p-3"><h2 className="text-sm font-bold text-navy">{dateLabel(day)} {day === today && <span className="text-xs text-indigo">Today</span>}</h2><div className="mt-3 grid gap-2">{dayItems.length ? dayItems.map((item) => <Link key={item.id} href={`/recruiter/interviews?interview_id=${encodeURIComponent(item.id)}`} className="min-w-0 rounded-xl border border-line bg-white p-3 text-sm hover:border-indigo/40"><time className="block text-xs font-bold text-indigo" dateTime={item.scheduled_at}>{timeFormat.format(new Date(item.scheduled_at))} IST</time><span className="mt-1 block truncate font-bold text-navy">{item.candidate_name}</span><span className="block truncate text-xs text-ink-muted">{item.job_title} · {item.round_label}</span></Link>) : <p className="text-xs text-ink-muted">No scheduled interviews.</p>}</div></div>; })}
    </div>
  </section>;
}
