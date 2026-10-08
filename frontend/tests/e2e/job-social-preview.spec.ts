import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isPublicLogoAddress, loadPublicCompanyLogo, publicLogoURL } from "../../lib/public-company-logo";
import { MOCK_API, resetE2E } from "./helpers";

const id = "60000000-0000-4000-8000-000000000001";
const route = `/jobs/${id}`;
const bot = { "User-Agent": "LinkedInBot/1.0" };

test.beforeEach(async ({ request }) => { await resetE2E(request); });

test("anonymous social crawlers receive job-specific metadata in the initial head", async ({ request }) => {
  for (const userAgent of ["LinkedInBot/1.0", "Twitterbot/1.0", "facebookexternalhit/1.1"]) {
    const response = await request.get(route, { headers: { "User-Agent": userAgent }, maxRedirects: 0 });
    expect(response.status()).toBe(200);
    const html = await response.text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain("Senior Go Platform Engineer at Sapien Labs India | SapienWorx");
    for (const property of ["og:title", "og:description", "og:image", "og:url", "og:type", "og:site_name"]) expect(head).toContain(`property="${property}"`);
    expect(head).toContain("Mumbai, Maharashtra · Hybrid · 2–6 years · Go, PostgreSQL");
    expect(head).toContain(`${route}/social-card`);
    expect(head).toContain('name="twitter:card" content="summary_large_image"');
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect(html).toContain("Sign in to apply");
  }
});

test("canonical and image URLs follow trusted environments and reject forwarded-host poisoning", async ({ request }) => {
  for (const host of ["beta.sapienworx.com", "www.sapienworx.com", "sapienworx.com", "evil.example.test"]) {
    const response = await request.get(route, { headers: { ...bot, Host: host, "X-Forwarded-Host": "evil.example.test", "X-Forwarded-Proto": "http" } });
    expect(response.status()).toBe(200);
    const head = (await response.text()).split("</head>")[0];
    const expected = host === "evil.example.test" ? "beta.sapienworx.com" : host;
    expect(head).toContain(`property="og:url" content="https://${expected}${route}"`);
    expect(head).toContain(`property="og:image" content="https://${expected}${route}/social-card"`);
    expect(head).toContain(`rel="canonical" href="https://${expected}${route}"`);
    expect(head).not.toContain("evil.example.test");
  }
});

for (const variant of ["normal", "reference", "long", "incomplete", "untrusted-logo"] as const) {
  test(`${variant} share card is a public 1200x630 PNG`, async ({ request }) => {
    if (variant === "reference") await request.post(`${MOCK_API}/__e2e/public-job`, { data: { job: { title: "Senior Java Backend Engineer", company_name: "Acme Technologies", city: "Bengaluru", state: "", min_experience_months: 36, max_experience_months: 60, required_skills: ["Java", "Spring Boot", "AWS"] } } });
    if (variant === "long") await request.post(`${MOCK_API}/__e2e/public-job`, { data: { job: { title: "Senior Staff Principal Distributed Systems Engineering and Infrastructure Reliability Programme Lead for International Enterprise Platforms", company_name: "A Very Long Company Name With Multiple International Research And Engineering Divisions", city: "Thiruvananthapuram", state: "Kerala", required_skills: ["Distributed Architecture", "Infrastructure Reliability", "PostgreSQL", "AWS"] } } });
    if (variant === "incomplete") await request.post(`${MOCK_API}/__e2e/public-job`, { data: { job: { title: "", company_name: "", city: "", state: "", country_code: "", work_mode: "", min_experience_months: null, required_skills: null } } });
    if (variant === "untrusted-logo") await request.post(`${MOCK_API}/__e2e/public-job`, { data: { job: { company_logo_url: "https://169.254.169.254/latest/meta-data/" } } });
    const response = await request.get(route + "/social-card", { headers: { ...bot, Host: "beta.sapienworx.com" }, maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["set-cookie"]).toBeUndefined();
    const png = await response.body();
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    expect(png.length).toBeGreaterThan(10000);
    const directory = path.resolve("visual-artifacts/job-social-previews");
    await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, variant + ".png"), png);
    if (variant === "incomplete") {
      const html = await (await request.get(route, { headers: bot })).text();
      expect(html).toContain('property="og:title" content="SapienWorx Jobs"');
      expect(html).toContain("Find your next opportunity and apply on SapienWorx.");
    }
  });
}

test("private, closed, expired and unknown jobs cannot expose metadata or images", async ({ request }) => {
  for (const status of [403, 404]) {
    await request.post(`${MOCK_API}/__e2e/public-job`, { data: { status } });
    for (const suffix of ["", "/social-card"]) {
      const response = await request.get(route + suffix, { headers: bot });
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain("Senior Go Platform Engineer");
    }
  }
  for (const invalid of ["60000000-0000-4000-8000-000000000099", "not-a-job"]) {
    const response = await request.get(`/jobs/${invalid}/social-card`, { headers: bot });
    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).not.toBe("image/png");
  }
});

test("upstream server failures remain errors rather than cached branded successes", async ({ request }) => {
  for (const status of [500, 502, 503]) {
    await request.post(`${MOCK_API}/__e2e/public-job`, { data: { status } });
    const response = await request.get(route + "/social-card", { headers: bot });
    expect(response.status()).toBe(503);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.text()).not.toContain("Senior Go Platform Engineer");
    const page = await request.get(route, { headers: bot });
    expect(page.status()).toBe(500);
  }
});

test("job text stays escaped in metadata and the page works without browser scripts", async ({ browser, request }) => {
  await request.post(`${MOCK_API}/__e2e/public-job`, { data: { job: { title: 'Engineer <script>alert("job")</script> & Platform' } } });
  const context = await browser.newContext({ javaScriptEnabled: false, userAgent: bot["User-Agent"] });
  try {
    const page = await context.newPage(); await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText('Engineer <script>alert("job")</script> & Platform');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", 'Engineer <script>alert("job")</script> & Platform at Sapien Labs India');
    expect(await page.locator("script").allTextContents()).not.toContain('alert("job")');
  } finally { await context.close(); }
});

test("logo fetching rejects private, metadata, loopback and credential-bearing URLs", async () => {
  for (const address of ["127.0.0.1", "10.0.0.5", "169.254.169.254", "100.64.0.1", "172.31.0.1", "192.168.0.1", "0.0.0.0", "::1", "::ffff:127.0.0.1", "fd00::1", "fe80::1", "2001:db8::1"]) expect(isPublicLogoAddress(address)).toBe(false);
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPublicLogoAddress(address)).toBe(true);
  for (const url of ["http://example.com/logo.png", "https://localhost/logo", "https://127.0.0.1/logo", "https://169.254.169.254/", "https://user:password@example.com/logo", "https://example.com:8443/logo", "data:image/png;base64,aA=="]) {
    expect(publicLogoURL(url)).toBeNull();
    expect(await loadPublicCompanyLogo(url)).toBeNull();
  }
  expect(publicLogoURL("https://cdn.example.com/logo.png")?.hostname).toBe("cdn.example.com");
});
