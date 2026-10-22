import type { ReactNode } from "react";

import { canonicalJobPath } from "@/lib/job-public-path";
import { publicJob, publicJobOrigin } from "@/lib/public-job";
import { jobPostingJsonLd } from "@/lib/seo/job-posting";

type Props = {
  children: ReactNode;
  params: Promise<{ jobID: string }>;
};

export default async function JobDetailLayout({ children, params }: Props) {
  const { jobID } = await params;
  const [job, origin] = await Promise.all([publicJob(jobID), publicJobOrigin()]);
  const canonicalUrl = origin + (canonicalJobPath(job.job_reference) || `/jobs/${encodeURIComponent(job.id)}`);
  const structuredData = jobPostingJsonLd(job, canonicalUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      {children}
    </>
  );
}
