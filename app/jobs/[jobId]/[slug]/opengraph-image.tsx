import { ImageResponse } from "next/og";
import { getPublicJob } from "../../../../lib/backend";

export const alt = "Sapienworx job listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function compact(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1).trim()}…` : value;
}

export default async function OpenGraphImage({ params }: { params: Promise<{ jobId: string; slug: string }> }) {
  const { jobId } = await params;
  const job = await getPublicJob(jobId);
  const title = compact(job?.title ?? "Career opportunity", 58);
  const company = compact(job?.organisationName ?? "Sapienworx partner", 38);
  const location = compact(job?.location ?? "Location shared in the role", 42);
  const experience = job ? `${job.minimumExperienceYears}–${job.maximumExperienceYears} Yrs Exp` : "View role details";
  const skills = (job?.skills ?? []).slice(0, 4);
  const titleSize = title.length > 44 ? 47 : title.length > 30 ? 54 : 62;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "linear-gradient(100deg, #ffffff 0%, #ffffff 52%, #f5f9ff 100%)", color: "#071b38", fontFamily: "Arial, sans-serif", padding: "86px 92px" }}>
      <div style={{ width: 325, height: 390, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: "2px solid #e5eaf2", paddingRight: 58 }}>
        <div style={{ width: 74, height: 74, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "linear-gradient(145deg, #0e6aa8, #27a4a0)", color: "white", fontSize: 45, fontWeight: 800, transform: "rotate(45deg)" }}>
          <span style={{ display: "flex", transform: "rotate(-45deg)" }}>S</span>
        </div>
        <div style={{ display: "flex", marginTop: 28, color: "#1764e8", fontSize: 36, fontWeight: 800, letterSpacing: "-1.5px" }}>Sapienworx</div>
        <div style={{ display: "flex", marginTop: 10, color: "#324662", fontSize: 13, fontWeight: 700, letterSpacing: "3px" }}>ENTERPRISE RECRUITMENT</div>
      </div>
      <div style={{ flex: 1, height: 390, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 62 }}>
        <div style={{ display: "flex", maxWidth: 680, fontSize: titleSize, fontWeight: 800, lineHeight: 1.04, letterSpacing: "-2.3px" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 24 }}>
          <div style={{ width: 54, height: 54, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #cadcf7", background: "#eef6ff", color: "#16739d", fontSize: 28, fontWeight: 800 }}>S</div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 14 }}>
            <span style={{ display: "flex", color: "#233a58", fontSize: 20, fontWeight: 700 }}>{company}</span>
            <span style={{ display: "flex", marginTop: 4, color: "#6e7c91", fontSize: 15 }}>Actively hiring</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 20, color: "#315883", fontSize: 15 }}>
          <span style={{ display: "flex", border: "1px solid #bdd2fb", borderRadius: 999, background: "#eaf2ff", padding: "8px 15px" }}>EXP&nbsp; {experience}</span>
          <span style={{ display: "flex", border: "1px solid #bdd2fb", borderRadius: 999, background: "#eaf2ff", padding: "8px 15px" }}>LOC&nbsp; {location}</span>
        </div>
        <div style={{ display: "flex", gap: 9, marginTop: 28 }}>
          {(skills.length ? skills : ["View job", "Apply securely"]).map((skill) => <span key={skill} style={{ display: "flex", border: "1px solid #d5deea", background: "#fff", padding: "7px 12px", color: "#4d617c", fontSize: 13 }}>{compact(skill, 18)}</span>)}
        </div>
      </div>
    </div>,
    size,
  );
}
