import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const productionHosts = new Set(["sapienworx.com", "www.sapienworx.com"]);

export async function GET() {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const production = productionHosts.has(host);

  const body = production
    ? [
        "User-agent: *",
        "Allow: /",
        "Disallow: /candidate/",
        "Disallow: /recruiter/",
        "Disallow: /company/",
        "Disallow: /profile/",
        "Disallow: /onboarding/",
        "Disallow: /login",
        "Disallow: /signup",
        "Disallow: /forgot-password",
        "",
        "User-agent: OAI-SearchBot",
        "Allow: /",
        "Disallow: /candidate/",
        "Disallow: /recruiter/",
        "Disallow: /company/",
        "Disallow: /profile/",
        "Disallow: /onboarding/",
        "",
        "User-agent: GPTBot",
        "Disallow: /",
        "",
        "Sitemap: https://sapienworx.com/sitemap.xml",
      ]
    : ["User-agent: *", "Disallow: /"];

  return new Response(`${body.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
