import { ImageResponse } from "next/og";
import { getPublicJob } from "../../../../lib/backend";

export const alt = "Sapienworx job listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ jobId: string; slug: string }> }) {
  const { jobId } = await params;
  const job = await getPublicJob(jobId);
  const title = job?.title ?? "Career opportunity";
  const company = job?.organisationName ?? "Sapienworx";
  const location = job?.location ?? "India";
  const experience = job ? `${job.minimumExperienceYears}–${job.maximumExperienceYears} years experience` : "Discover your next role";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 76px",
          background: "linear-gradient(130deg, #071f45 0%, #0b4275 58%, #0d837e 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 28, fontWeight: 700 }}>
          <div style={{ display: "flex", width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, background: "#7de0d8", color: "#06305b" }}>S</div>
          Sapienworx
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 30, color: "#bceff0" }}>{company}</div>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.08 }}>{title}</div>
          <div style={{ display: "flex", gap: 16, fontSize: 24, color: "#d7f7f4" }}>
            <span>{location}</span><span>•</span><span>{experience}</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#bceff0" }}>Apply through Sapienworx</div>
      </div>
    ),
    size,
  );
}
