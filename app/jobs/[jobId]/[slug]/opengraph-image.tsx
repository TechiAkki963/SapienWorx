/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPublicJob } from "../../../../lib/backend";

export const alt = "Sapienworx job listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function compact(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1).trim()}…` : value;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "SW";
}

const logoData = await readFile(join(process.cwd(), "public", "brand", "sapienworx-mark.jpeg"), "base64");
const logoSrc = `data:image/jpeg;base64,${logoData}`;

export default async function OpenGraphImage({ params }: { params: Promise<{ jobId: string; slug: string }> }) {
  const { jobId } = await params;
  const job = await getPublicJob(jobId);
  const title = compact(job?.title ?? "Career opportunity", 58);
  const company = compact(job?.organisationName ?? "Sapienworx partner", 38);
  const location = compact(job?.location ?? "Location shared in the role", 42);
  const experience = job ? `${job.minimumExperienceYears}–${job.maximumExperienceYears} Yrs Exp` : "View role details";
  const companyInitials = initials(company);
  const companyLogo = job?.verifiedEmployer ? job.organisationLogoUrl : null;
  const companyColour = job?.verifiedEmployer && /^#[0-9A-Fa-f]{6}$/.test(job.organisationBrandColour ?? "") ? job.organisationBrandColour! : "#dddddb";
  const titleLines = title.length > 42 ? 3 : title.length > 20 ? 2 : 1;
  const titleSize = titleLines === 3 ? 42 : titleLines === 2 ? 50 : 62;
  const titleHeight = titleLines === 3 ? 142 : titleLines === 2 ? 105 : 68;
  const titleMargin = titleLines === 3 ? 22 : titleLines === 2 ? 30 : 39;
  const detailMargin = titleLines === 3 ? 12 : titleLines === 2 ? 18 : 24;
  const domainMargin = titleLines === 3 ? 24 : titleLines === 2 ? 32 : 43;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f1ef", color: "#101010", padding: 8 }}>
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "#ffffff", border: "1px solid #e7e7e4", borderRadius: 32, padding: "72px 84px" }}>
        <div style={{ width: 330, height: 420, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={205} height={203} alt="" style={{ objectFit: "cover", borderRadius: 20 }} />
          <div style={{ display: "flex", marginTop: 22, color: "#0d537d", fontFamily: "Arial, sans-serif", fontSize: 31, fontWeight: 800, letterSpacing: "-1.3px" }}>Sapienworx</div>
        </div>
        <div style={{ width: 1, height: 410, display: "flex", background: "#202020", marginLeft: 30 }} />
        <div style={{ flex: 1, height: 410, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 84, fontFamily: "Georgia, serif" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {companyLogo ? <img src={companyLogo} width={82} height={82} alt="" style={{ objectFit: "contain", background: "#ffffff", border: "1px solid #e4e4df" }} /> : <div style={{ width: 82, height: 82, display: "flex", alignItems: "center", justifyContent: "center", background: companyColour, color: companyColour.toLowerCase() === "#dddddb" ? "#181818" : "#ffffff", fontSize: 27 }}>{companyInitials}</div>}
            <div style={{ display: "flex", marginTop: 13, color: "#292929", fontSize: 18 }}>{company}</div>
          </div>
          <div style={{ display: "flex", width: 620, height: titleHeight, marginTop: titleMargin, fontSize: titleSize, lineHeight: 1.04, letterSpacing: "-1.7px" }}>{title}</div>
          <div style={{ display: "flex", marginTop: detailMargin, color: "#202020", fontSize: 27 }}>{experience.replace("Yrs Exp", "years")}</div>
          <div style={{ display: "flex", marginTop: 15, color: "#202020", fontSize: 25 }}>{location}</div>
          <div style={{ display: "flex", marginTop: domainMargin, color: "#111111", fontSize: 28 }}>www.sapienworx.com</div>
        </div>
      </div>
    </div>,
    size,
  );
}
