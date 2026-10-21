// The Go messaging service limits trimmed content to 5,000 UTF-8 bytes.
// Keep that existing policy; UTF-16 string.length is not a byte count.
export const MAX_MESSAGE_BYTES = 5000;

export function messageBytes(value: string) {
  return new TextEncoder().encode(value.trim()).length;
}

export function insertMessageEmoji(value: string, start: number, end: number, emoji: string) {
  const boundaries = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].map(part => part.index);
  boundaries.push(value.length);
  const from = boundaries.findLast(index => index <= Math.max(0, start)) ?? 0;
  const to = start === end ? from : boundaries.find(index => index >= end) ?? value.length;
  const next = value.slice(0, from) + emoji + value.slice(to);
  if (messageBytes(next) > MAX_MESSAGE_BYTES) return null;
  return { value: next, cursor: from + emoji.length };
}
