import { ImageResponse } from "next/og";
import { JobSocialCard } from "@/components/jobs/job-social-card";
import { BackendResponseError } from "@/lib/candidate-server";
import { jobSocialData } from "@/lib/job-social-data";
import { jobSocialFonts } from "@/lib/job-social-fonts";
import { loadPublicCompanyLogo } from "@/lib/public-company-logo";
import { publicJob, publicJobOrigin } from "@/lib/public-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ jobID: string }> }) {
  const { jobID } = await params;
  let job;
  try { job = await publicJob(jobID); }
  catch (error) {
    if (error instanceof BackendResponseError) {
      return new Response("Job preview temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    throw error;
  }
  const data = jobSocialData(job);
  const domain = new URL(await publicJobOrigin()).hostname;
  const logo = await loadPublicCompanyLogo(job.company_logo_url);
  const fonts = await jobSocialFonts();
  const render = (image: string | null) => new ImageResponse(<JobSocialCard data={data} logo={image} domain={domain} />, { width: 1200, height: 630, fonts }).arrayBuffer();
  let bytes;
  try { bytes = await render(logo); }
  catch (error) {
    if (!logo) throw error;
    // An inaccessible/undecodable logo must never erase the job's preview.
    bytes = await render(null);
  }
  return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
