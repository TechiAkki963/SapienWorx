export type ParsedExperience = {
  company: string;
  role: string;
  dates?: string;
  description?: string;
};

export type ParsedProfile = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  skills: string[];
  certifications: string[];
  links: string[];
  experience: ParsedExperience[];
  education: string[];
  warnings: string[];
  parserVersion: "deterministic-0.1";
};

const sectionNames: Record<string, string[]> = {
  summary: ["summary", "profile", "professional summary", "about"],
  skills: ["skills", "technical skills", "core skills", "competencies"],
  experience: ["experience", "work experience", "employment", "professional experience"],
  education: ["education", "academic background", "qualifications"],
  certifications: ["certifications", "certificates", "professional certifications"],
};

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/;
const urlPattern = /(?:https?:\/\/|www\.)[^\s,]+/gi;
const datePattern = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{4})[\s.\-–]+(?:Present|Current|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{4})/i;

function cleanLine(line: string) {
  return line.replace(/^[•·▪◦\-–]+\s*/, "").replace(/\s+/g, " ").trim();
}

function normaliseHeading(line: string) {
  return cleanLine(line).toLowerCase().replace(/:$/, "");
}

function getSections(lines: string[]) {
  const sections: Record<string, string[]> = { header: [] };
  let active = "header";
  for (const line of lines) {
    const matched = Object.entries(sectionNames).find(([, names]) => names.includes(normaliseHeading(line)));
    if (matched) {
      active = matched[0];
      sections[active] ??= [];
      continue;
    }
    sections[active].push(line);
  }
  return sections;
}

function listFromLines(lines: string[] = []) {
  return lines.flatMap((line) => cleanLine(line).split(/[|,;•]/)).map(cleanLine).filter((item) => item.length > 1).slice(0, 20);
}

function extractExperiences(lines: string[] = []): ParsedExperience[] {
  const entries: ParsedExperience[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanLine(lines[index]);
    if (!line) continue;
    const following = cleanLine(lines[index + 1] ?? "");
    const [role, company] = line.split(/\s+(?:at|\||—|–|-)\s+/i).map(cleanLine);
    if (role && company && role.length > 2 && company.length > 1) {
      entries.push({ role, company, dates: datePattern.test(following) ? following : undefined, description: datePattern.test(following) ? cleanLine(lines[index + 2] ?? "") : following });
    }
  }
  return entries.slice(0, 8);
}

/**
 * A deliberately deterministic, non-AI parser for plain CV text. Binary document
 * extraction belongs in the server-side ParserEngine before calling this function.
 */
export function parseResumeText(source: string): ParsedProfile {
  const lines = source.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const sections = getSections(lines);
  const header = sections.header ?? [];
  const email = source.match(emailPattern)?.[0];
  const phone = source.match(phonePattern)?.[0];
  const links = Array.from(source.matchAll(urlPattern), (match) => match[0].replace(/[).,]+$/, ""));
  const possibleName = header.find((line) => line.length < 55 && !emailPattern.test(line) && !phonePattern.test(line) && !urlPattern.test(line));
  const warnings: string[] = [];
  if (!email) warnings.push("No email address was found.");
  if (!sections.experience?.length) warnings.push("No work experience section was found.");
  if (!sections.skills?.length) warnings.push("No skills section was found.");

  return {
    name: possibleName,
    email,
    phone,
    location: header.find((line) => /(?:,|remote|india|united kingdom|london|mumbai|delhi|bangalore)/i.test(line)),
    headline: header.find((line) => /(designer|engineer|developer|manager|analyst|consultant|architect)/i.test(line)),
    summary: (sections.summary ?? []).join(" ").slice(0, 700) || undefined,
    skills: listFromLines(sections.skills),
    certifications: listFromLines(sections.certifications),
    links,
    experience: extractExperiences(sections.experience),
    education: listFromLines(sections.education),
    warnings,
    parserVersion: "deterministic-0.1",
  };
}
