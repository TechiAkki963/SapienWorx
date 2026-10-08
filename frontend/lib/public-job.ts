import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CandidateJob } from "@/lib/candidate";
import { BackendResponseError, publicAPI } from "@/lib/candidate-server";

// Share cards use the same anonymous visibility/lifecycle check as the page.
// Request-local memoization shares this read with generateMetadata, never sessions.
export const publicJob = cache(async (jobID: string): Promise<CandidateJob> => {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(jobID)) notFound();
  try {
    return await publicAPI<CandidateJob>(`/api/v1/jobs/${encodeURIComponent(jobID)}`);
  } catch (error) {
    if (error instanceof BackendResponseError && [403, 404].includes(error.status)) notFound();
    throw error;
  }
});

export async function publicJobOrigin(): Promise<string> {
  const host = (await headers()).get("host")?.toLowerCase();
  // Caddy preserves Host. Allow only our public hosts; forwarded headers and
  // arbitrary Host values must never poison canonical/image URLs.
  if (host && ["beta.sapienworx.com", "www.sapienworx.com", "sapienworx.com"].includes(host)) {
    return `https://${host}`;
  }
  if (host && /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host)) return `http://${host}`;
  return "https://beta.sapienworx.com";
}
