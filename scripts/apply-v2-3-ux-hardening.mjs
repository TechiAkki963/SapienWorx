import { readFile, writeFile } from "node:fs/promises";

async function update(path, transform) {
  const original = await readFile(path, "utf8");
  const next = transform(original);
  if (next === original) {
    console.log(`No source hardening changes required in ${path}`);
    return;
  }
  await writeFile(path, next, "utf8");
  console.log(`Hardened ${path}`);
}

await update("components/candidate.tsx", (source) => {
  let next = source;

  const previewPattern = /const dashboardPreview: CandidateDashboardData = \{[\s\S]*?\n\};\n\nexport function CandidateDashboard/;
  if (previewPattern.test(next)) next = next.replace(previewPattern, "export function CandidateDashboard");
  next = next.replace(
    'export function CandidateDashboard({ initialData }: { initialData?: CandidateDashboardData | null }) {',
    'export function CandidateDashboard({ initialData }: { initialData: CandidateDashboardData }) {'
  );
  next = next.replace('const [dashboard, setDashboard] = useState(initialData ?? dashboardPreview);', 'const [dashboard, setDashboard] = useState(initialData);');
  next = next.replace(
    'const [rangeDays, setRangeDays] = useState<DashboardRange>((initialData?.performance.rangeDays as DashboardRange) ?? 90);',
    'const [rangeDays, setRangeDays] = useState<DashboardRange>((initialData.performance.rangeDays as DashboardRange) || 90);'
  );

  const resumeReviewPattern = /export function ResumeReview\(\) \{[\s\S]*?\n\ntype CandidateJob/;
  if (resumeReviewPattern.test(next)) next = next.replace(resumeReviewPattern, "type CandidateJob");

  /* Remove the old fictional signed-in job preview and its unused legacy renderer. */
  next = next.replace(/const jobListings: CandidateJob\[\] = \[[\s\S]*?\n\];\n\n/, "");
  next = next.replace(/function LegacyCandidateJobs\(\) \{[\s\S]*?\n\}\n\nfunction FilterControl/, "function FilterControl");
  next = next.replace('; matchScore: number; match?: string;', ';');

  /* Candidate Jobs must start empty and only render real backend jobs. */
  next = next.replace('const [jobs, setJobs] = useState<CandidateJob[]>(jobListings);', 'const [jobs, setJobs] = useState<CandidateJob[]>([]);');
  next = next.replace(
    'if (response.content.length) setJobs(response.content.map((job, index) => toCandidateJob(job, index)));',
    'setJobs(response.content.map((job, index) => toCandidateJob(job, index)));'
  );
  next = next.replace(
    'if (!(reason instanceof DOMException && reason.name === "AbortError")) {\n        /* Retain the useful preview while the public opportunity feed starts. */\n      }',
    'if (!(reason instanceof DOMException && reason.name === "AbortError")) {\n        setError(reason instanceof Error ? reason.message : "We could not load the live job feed. Please try again.");\n        setJobs([]);\n      }'
  );

  /* No fabricated relevance score: preserve backend feed order for the default view. */
  next = next.replace(
    ': right.matchScore - left.matchScore), [matchingJobs, saved, sort, view]);',
    ': 0), [matchingJobs, saved, sort, view]);'
  );
  next = next.replace('"Recommended for you"', '"Live opportunities"');
  next = next.replace('"Ordered using profile relevance, then your selected preferences."', '"Shown in the order supplied by the live job feed, with your filters applied."');
  next = next.replace('<option value="RELEVANCE">Best match</option>', '<option value="RELEVANCE">Feed order</option>');
  next = next.replace(/<div className="candidate-job-match"><strong>\{job\.matchScore\}% match<\/strong><span>Based on your profile and selected preferences<\/span><\/div>/g, "");
  next = next.replace(/, matchScore: Math\.max\(62, 94 - \(index \* 4\)\)/g, "");

  if (next.includes("dashboardPreview") || next.includes("Amara_Mensah_Resume.pdf") || next.includes("jobListings") || next.includes("% match</strong>")) {
    throw new Error("Candidate fictional-data cleanup did not complete safely.");
  }
  return next;
});

await update("components/ui.tsx", (source) => {
  let next = source;
  next = next.replace('    { id: "candidates", label: "Candidates", href: "/recruiter/candidates", icon: "people" },\n', "");
  next = next.replace(
    '    { id: "sourcing", label: "Sourcing", href: "/recruiter/sourcing", icon: "search" },',
    '    { id: "sourcing", label: "Candidates", href: "/recruiter/sourcing", icon: "people" },'
  );
  next = next.replace(
    '  recruiter: [navigation.recruiter[0], navigation.recruiter[1], navigation.recruiter[2], navigation.recruiter[5], navigation.recruiter[7]],',
    '  recruiter: [navigation.recruiter[0], navigation.recruiter[1], navigation.recruiter[2], navigation.recruiter[4], navigation.recruiter[6]],'
  );
  next = next.replace(
    '  const activeNow = item.id === active || (item.id === "candidates" && active === "pipeline");',
    '  const activeNow = item.id === active;'
  );

  if (next.includes('id: "candidates"') || next.includes('label: "Sourcing"')) {
    throw new Error("Recruiter navigation cleanup did not complete safely.");
  }
  return next;
});
