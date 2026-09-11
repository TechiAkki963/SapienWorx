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
  if (previewPattern.test(next)) {
    next = next.replace(previewPattern, "export function CandidateDashboard");
  }
  next = next.replace(
    'export function CandidateDashboard({ initialData }: { initialData?: CandidateDashboardData | null }) {',
    'export function CandidateDashboard({ initialData }: { initialData: CandidateDashboardData }) {'
  );
  next = next.replace(
    'const [dashboard, setDashboard] = useState(initialData ?? dashboardPreview);',
    'const [dashboard, setDashboard] = useState(initialData);'
  );
  next = next.replace(
    'const [rangeDays, setRangeDays] = useState<DashboardRange>((initialData?.performance.rangeDays as DashboardRange) ?? 90);',
    'const [rangeDays, setRangeDays] = useState<DashboardRange>((initialData.performance.rangeDays as DashboardRange) || 90);'
  );

  const resumeReviewPattern = /export function ResumeReview\(\) \{[\s\S]*?\n\ntype CandidateJob/;
  if (resumeReviewPattern.test(next)) {
    next = next.replace(resumeReviewPattern, "type CandidateJob");
  }

  if (next.includes("dashboardPreview") || next.includes("Amara_Mensah_Resume.pdf")) {
    throw new Error("Candidate sample-data cleanup did not complete safely.");
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
