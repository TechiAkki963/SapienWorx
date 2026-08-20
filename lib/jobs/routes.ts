export const knownJobRoutes = [
  { jobId: "SWX_NT_001", slug: "growth-marketing-lead" },
  { jobId: "SWX_NT_002", slug: "product-marketing-manager" },
  { jobId: "SWX_NT_003", slug: "senior-product-designer" },
  { jobId: "SWX_NT_004", slug: "frontend-engineer" },
  { jobId: "SWX_NT_005", slug: "talent-operations-specialist" },
  { jobId: "SWX_NT_006", slug: "brand-designer" },
];

export function jobTitleSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function publicJobPath(jobId: string, title: string) {
  return `/jobs/${encodeURIComponent(jobId)}/${jobTitleSlug(title)}`;
}
