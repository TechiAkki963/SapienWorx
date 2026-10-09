import type { jobSocialData } from "@/lib/job-social-data";

function shorten(value: string, maximum: number) {
  if (value.length <= maximum) return value;
  return `${value.slice(0, maximum - 1).replace(/\s+\S*$/, "").trim()}…`;
}

export function JobSocialCard({ data, logo, domain }: { data: ReturnType<typeof jobSocialData>; logo: string | null; domain: string }) {
  const title = shorten(data.title, 90);
  const heading = data.company ? `${title} – ${shorten(data.company, 52)}` : title;
  const summary = [...data.details, data.skills.slice(0, 3).join(", ")].filter(Boolean).join(" · ");
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", padding: 40, background: "#f8fafc", fontFamily: "Noto Sans" }}>
      <div style={{ display: "flex", alignItems: "center", width: 1120, minHeight: 370, padding: 28, border: "2px solid #e2e8f0", borderRadius: 24, background: "#ffffff", boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 220, height: 250, flexShrink: 0, borderRadius: 20, background: "linear-gradient(145deg, #0a66ff, #0645e8)", color: "#ffffff" }}>
          <div style={{ display: "flex", fontSize: 100, fontWeight: 700, lineHeight: 1 }}>S</div>
          <div style={{ display: "flex", fontSize: 31, fontWeight: 700, marginTop: 14 }}>SapienWorx</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 32, width: 808, minWidth: 0 }}>
          <div style={{ display: "flex", fontSize: heading.length > 105 ? 31 : 36, fontWeight: 700, lineHeight: 1.2, color: "#0f172a", overflowWrap: "anywhere" }}>{heading}</div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 27, lineHeight: 1.3, color: "#475569", overflowWrap: "anywhere" }}>{shorten(summary, 185) || "Explore your next opportunity on SapienWorx"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22 }}>
            {data.company && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, flexShrink: 0, borderRadius: 8, background: "#eef2ff", color: "#4338ca", fontSize: 16, fontWeight: 700, overflow: "hidden" }}>{logo ? <img src={logo} width={36} height={36} style={{ objectFit: "contain" }} alt="" /> : data.initials}</div>}
            <div style={{ display: "flex", fontSize: 25, color: "#64748b" }}>{domain}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
