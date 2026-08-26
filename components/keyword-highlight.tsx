import { Fragment, type ReactNode } from "react";

/** Renders user-supplied search terms safely: React escapes every text fragment. */
export function highlightKeywords(text: string, keywords: string[]): ReactNode {
  const terms = [...new Set(keywords.map((keyword) => keyword.replaceAll('"', "").trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length);
  if (!terms.length) return text;
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(matcher).map((part, index) => index % 2 === 1
    ? <mark key={`${part}-${index}`}>{part}</mark>
    : <Fragment key={`${part}-${index}`}>{part}</Fragment>);
}
