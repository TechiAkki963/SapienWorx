/** Interpret the entered wall time in the chosen IANA zone, independent of the
 * browser's timezone. Reject DST gaps/folds instead of silently moving a meeting. */
export function interviewTimeISO(value: string, zone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Enter a valid interview date and time.");
  const target = new Date(value + ":00Z").getTime();
  if (!Number.isFinite(target)) throw new Error("Enter a valid interview date and time.");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const wall = (stamp: number) => { const parts = Object.fromEntries(formatter.formatToParts(stamp).map(part => [part.type,part.value])); return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`; };
  let guess = target;
  for (let i = 0; i < 4; i++) { const represented = new Date(wall(guess) + ":00Z").getTime(); guess += target - represented; }
  if (wall(guess) !== value) throw new Error("This time does not exist in the selected timezone. Choose a time outside the daylight-saving change.");
  if (wall(guess - 3600000) === value || wall(guess + 3600000) === value) throw new Error("This time occurs twice in the selected timezone. Choose an unambiguous time outside the daylight-saving change.");
  return new Date(guess).toISOString();
}
