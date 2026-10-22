import { guides } from "@/lib/knowledge-hub";

export const dynamic = "force-dynamic";

const origin = "https://sapienworx.com";

function entry(path: string, priority: string, changefreq: string) {
  return `<url><loc>${origin}${path}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export async function GET() {
  const urls = [
    entry("/", "1.0", "weekly"),
    entry("/jobs", "0.9", "daily"),
    entry("/companies", "0.8", "daily"),
    entry("/resources", "0.8", "weekly"),
    entry("/privacy", "0.2", "yearly"),
    entry("/terms", "0.2", "yearly"),
    entry("/cookies", "0.2", "yearly"),
    ...guides.map((guide) => entry(`/resources/${guide.slug}`, "0.7", "monthly")),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>\n`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
