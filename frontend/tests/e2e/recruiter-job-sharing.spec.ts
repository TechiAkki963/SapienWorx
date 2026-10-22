import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { login, MOCK_API, recordedRequests, resetE2E } from "./helpers";
import { publicJobShareLinks } from "../../lib/use-public-job-share";

async function textContrast(locator: import("@playwright/test").Locator) {
  return locator.evaluate(element => {
    const canvas = document.createElement("canvas"); canvas.width=canvas.height=1; const ctx=canvas.getContext("2d")!;
    const color=(value:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data]};
    const blend=(front:number[],back:number[])=>front.slice(0,3).map((v,i)=>v*front[3]/255+back[i]*(1-front[3]/255));
    const background=(node:Element|null):number[]=>node?blend(color(getComputedStyle(node).backgroundColor),background(node.parentElement)):[255,255,255];
    const bg=background(element),fg=blend(color(getComputedStyle(element).color),bg);
    const luminance=(rgb:number[])=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    return (Math.max(luminance(fg),luminance(bg))+.05)/(Math.min(luminance(fg),luminance(bg))+.05);
  });
}

const id = "60000000-0000-4000-8000-000000000001";
const title = "Senior Go Platform Engineer";
const actions = (page: Page) => page.getByRole("dialog", { name: title, exact: true });
const share = (page: Page) => page.getByRole("dialog", { name: "Share job", exact: true });
async function openActions(page: Page) {
  await page.goto("/recruiter/jobs");
  await page.getByRole("button", { name: `More actions for ${title}` }).first().click();
  await expect(actions(page).getByText("Checking job permissions…")).toBeHidden();
}
test.beforeEach(async ({ request }) => resetE2E(request));

test("public sharing is discoverable, canonical, explicit and keyboard accessible", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page, "recruiter"); await openActions(page);
  const trigger = actions(page).getByRole("button", { name: "Share job", exact: true });
  await expect(trigger).toBeEnabled(); await expect(actions(page).getByText("Status: Active", { exact: true })).toBeVisible();
  await expect(actions(page).getByText("Visibility: Public", { exact: true })).toBeVisible();
  await trigger.focus(); await trigger.press("Enter");
  const panel = share(page); await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Public job link")).toHaveValue(/\/jobs\/SWX-JOB-2026-00001$/);
  const url = await panel.getByLabel("Public job link").inputValue();
  expect(url).not.toContain(id); expect(new URL(url).search).toBe("");
  await expect(panel.getByRole("button", { name: "Copy link", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Copied ✓", exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Copy link", exact: true })).toBeVisible({ timeout: 3500 });
  for (const name of ["LinkedIn", "WhatsApp", "Facebook", "X / Twitter", "Email"]) await expect(panel.getByRole("link", { name, exact: true })).toBeVisible();
  const linkedIn = new URL((await panel.getByRole("link", { name: "LinkedIn", exact: true }).getAttribute("href"))!);
  expect(linkedIn.searchParams.get("url")).toBe(url);
  const wa = new URL((await panel.getByRole("link", { name: "WhatsApp", exact: true }).getAttribute("href"))!);
  expect(wa.searchParams.get("text")).toBe(`We’re hiring: ${title} at Sapien Labs India.\n\nView the role and apply:\n${url}`);
  const email = new URL((await panel.getByRole("link", { name: "Email", exact: true }).getAttribute("href"))!);
  expect(email.searchParams.get("subject")).toBe(`We’re hiring — ${title}`);
  expect(email.searchParams.get("body")).toContain(url);
  await expect(panel.getByRole("link", { name: "LinkedIn", exact: true })).toHaveAttribute("rel", "noopener noreferrer");
  const close = panel.getByRole("button", { name: "Close Share job", exact: true });
  await close.focus(); await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("dialog")?.getAttribute("aria-modal"))).toBe("true");
  await page.keyboard.press("Escape"); await expect(panel).toBeHidden(); await expect(trigger).toBeFocused();
  await page.keyboard.press("Escape"); await expect(actions(page)).toBeHidden();
  await expect(page.getByRole("button", { name: `More actions for ${title}` }).first()).toBeFocused();
});

test("private to public requires explicit confirmation and refreshes without page reload", async ({ page, request }) => {
  await request.post(`${MOCK_API}/__e2e/recruiter-job-sharing`, { data: { visibility: "private" } });
  await login(page, "recruiter"); await openActions(page);
  await expect(actions(page).getByRole("button", { name: "Share job", exact: true })).toBeDisabled();
  await expect(actions(page).getByText("This job is private. Make it public to share it externally.")).toBeVisible();
  await actions(page).getByRole("button", { name: "Make job public", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Make this job public?", exact: true });
  await expect(confirm.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  expect((await recordedRequests(request)).filter(r => r.method === "PATCH" && r.path.endsWith("/visibility"))).toHaveLength(0);
  await page.keyboard.press("Escape"); await expect(confirm).toBeHidden();
  await expect(actions(page).getByRole("button", { name: "Make job public", exact: true })).toBeFocused();
  await actions(page).getByRole("button", { name: "Make job public", exact: true }).click();
  await confirm.getByRole("button", { name: "Make public", exact: true }).click();
  await expect(confirm).toBeHidden(); await expect(actions(page).getByText("Visibility: Public", { exact: true })).toBeVisible();
  await expect(actions(page).getByRole("status")).toContainText("Job is now public and ready to share.");
  await expect(actions(page).getByRole("button", { name: "Share job", exact: true })).toBeEnabled();
  await expect(actions(page).getByRole("button", { name: "Share job", exact: true })).toBeFocused();
  const updates = (await recordedRequests(request)).filter(r => r.method === "PATCH" && r.path.endsWith("/visibility"));
  expect(updates).toHaveLength(1); expect(updates[0].body).toMatchObject({ visibility: "public", expected_visibility: "private", expected_status: "active" });
  expect(typeof updates[0].body.expected_updated_at).toBe("string");
});

for (const failure of [403, 409, 503]) test(`visibility failure ${failure} preserves Private and allows a safe retry`, async ({ page, request }) => {
  await request.post(`${MOCK_API}/__e2e/recruiter-job-sharing`, { data: { visibility: "private", failure } });
  await login(page, "recruiter"); await openActions(page);
  await actions(page).getByRole("button", { name: "Make job public", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Make this job public?", exact: true });
  await confirm.getByRole("button", { name: "Make public", exact: true }).click();
  await expect(confirm.getByRole("alert")).toBeVisible(); await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(actions(page).getByText("Visibility: Private", { exact: true })).toBeVisible();
  await expect(actions(page).getByRole("button", { name: "Share job", exact: true })).toBeDisabled();
});

test("unauthorized recruiter sees restricted Share without a visibility-changing action", async ({ page, request }) => {
  await request.post(`${MOCK_API}/__e2e/recruiter-job-sharing`, { data: { visibility: "private", can_change_visibility: false } });
  await login(page, "recruiter"); await openActions(page);
  await expect(actions(page).getByRole("button", { name: "Make job public", exact: true })).toHaveCount(0);
  await expect(actions(page).getByRole("button", { name: "Share job", exact: true })).toBeDisabled();
});
for (const status of ["draft", "archived", "closed", "paused", "expired"]) test(`${status} has visible restricted Share and accurate explanation`, async ({ page, request }) => {
  await request.post(`${MOCK_API}/__e2e/recruiter-job-sharing`, { data: { status, visibility: "public" } });
  await login(page, "recruiter"); await openActions(page);
  await expect(actions(page).getByRole("button", { name: "Share job", exact: true })).toBeDisabled();
  await expect(actions(page).getByRole("button", { name: "Make job public", exact: true })).toHaveCount(0);
  if (status === "draft") await expect(actions(page).getByText("Publish this job publicly to enable sharing.")).toBeVisible();
  else if (status === "archived") await expect(actions(page).getByText("Archived jobs cannot be shared.")).toBeVisible();
  else await expect(actions(page).getByText(/jobs cannot be shared. Review the job status/)).toBeVisible();
});

test("permission read failure exposes no Make public action", async ({ page, request }) => {
  await request.post(`${MOCK_API}/__e2e/recruiter-job-sharing`, { data: { visibility: "private", read_status: 503 } });
  await login(page, "recruiter"); await openActions(page);
  await expect(actions(page).getByRole("alert")).toContainText("permissions could not be checked");
  await expect(actions(page).getByRole("button", { name: "Make job public", exact: true })).toHaveCount(0);
});

test("permission loading cannot expose a visibility-changing action early",async({page,request})=>{
  await request.post(`${MOCK_API}/__e2e/recruiter-job-sharing`,{data:{visibility:"private"}});
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve});
  await page.route(`**/api/v1/recruiter/jobs/${id}/visibility`,async route=>{await held;await route.continue()});
  await login(page,"recruiter");await page.goto("/recruiter/jobs");await page.getByRole("button",{name:`More actions for ${title}`}).first().click();
  await expect(actions(page).getByText("Checking job permissions…")).toBeVisible();await expect(actions(page).getByRole("button",{name:"Make job public",exact:true})).toHaveCount(0);
  release();await expect(actions(page).getByRole("button",{name:"Make job public",exact:true})).toBeVisible();
});

for (const status of [404, 503]) test(`public availability ${status} never exposes a share URL`, async ({ page }) => {
  await login(page, "recruiter"); await openActions(page);
  await page.route(`**/api/v1/jobs/${id}`, route => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { message: "Unavailable" } }) }));
  await actions(page).getByRole("button", { name: "Share job", exact: true }).click();
  await expect(share(page).getByRole("alert")).toBeVisible();
  await expect(share(page).getByLabel("Public job link")).toHaveCount(0);
  await expect(share(page).getByRole("link")).toHaveCount(0);
});

test("clipboard permission failure offers manual copying", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("Denied")) } }));
  await login(page, "recruiter"); await openActions(page); await actions(page).getByRole("button", { name: "Share job", exact: true }).click();
  await share(page).getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(share(page).getByRole("alert")).toContainText("copy it manually");
  await expect(share(page).getByLabel("Public job link")).toBeFocused();
});

test("share utilities reject sensitive/noncanonical URLs and encode reserved characters", () => {
  for (const url of ["https://beta.sapienworx.com/recruiter/jobs/private", "https://evil.example/jobs/SWX-JOB-2026-00001", "https://beta.sapienworx.com/jobs/SWX-JOB-2026-00001?token=private"]) expect(publicJobShareLinks(url, "Role", "Company")).toHaveLength(0);
  const url = "https://beta.sapienworx.com/jobs/SWX-JOB-2026-00001";
  const wa = publicJobShareLinks(url, "R&D Engineer + QA", "A&B / Example").find(s => s.provider === "whatsapp")!;
  expect(new URL(wa.href).searchParams.get("text")).toContain("R&D Engineer + QA at A&B / Example");
});

const viewports = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[390,844],[360,800]];
for (const [width,height] of viewports) for (const theme of ["light","dark","system"] as const) test(`sharing visual and interaction ${width}x${height} ${theme}`, async ({ page, request }) => {
  await mkdir(`visual-artifacts/recruiter-job-sharing/${width}x${height}`, { recursive: true });
  await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: theme === "light" ? "light" : "dark", reducedMotion: "reduce" });
  await page.addInitScript(value => localStorage.setItem("swx-theme", value), theme);
  await request.post(`${MOCK_API}/__e2e/recruiter-job-sharing`, { data: { visibility: "private" } });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {if(message.type()==="error")errors.push(message.text())});
  await login(page, "recruiter"); await openActions(page);
  const shot = async (name: string, dialog = actions(page)) => {
    await dialog.locator(".overflow-y-auto").first().evaluate(e=>{e.scrollTop=0});
    await expect(dialog).toBeVisible(); expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBeTruthy();
    const box = (await dialog.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(-1); expect(box.width).toBeLessThanOrEqual(width + 1); expect(box.height).toBeLessThanOrEqual(height + 1);
    await dialog.screenshot({ path: `visual-artifacts/recruiter-job-sharing/${width}x${height}/${name}-${theme}.png` });
  };
  await expect(actions(page).getByRole("button", { name: "Assign selected recruiter" })).toBeDisabled();
  expect(await textContrast(actions(page).getByText("This job is private. Make it public to share it externally."))).toBeGreaterThanOrEqual(4.5);
  await shot("private-actions");
  const lastStateAction=actions(page).getByRole("region",{name:"Job state controls"}).getByRole("button").last();
  await lastStateAction.scrollIntoViewIfNeeded();await expect(lastStateAction).toBeInViewport();
  await actions(page).getByRole("button", { name: "Make job public", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Make this job public?", exact: true }); await shot("make-public", confirm);
  await confirm.getByRole("button", { name: "Make public", exact: true }).click(); await expect(confirm).toBeHidden();
  // Wait for the requested RSC refresh before clipping a centered dialog whose
  // height can change while the permission refresh finishes.
  await page.waitForLoadState("networkidle");
  await expect(actions(page).getByText("Checking job permissions…")).toBeHidden();
  await shot("public-actions"); await actions(page).getByRole("button", { name: "Share job", exact: true }).click();
  await expect(share(page).getByLabel("Public job link")).toBeVisible(); await shot("share", share(page));
  for(const locator of [share(page).getByRole("heading",{name:"Share job",exact:true}),share(page).getByRole("link",{name:"LinkedIn",exact:true}),share(page).getByText("Sharing this job does not create a referral.")])expect(await textContrast(locator)).toBeGreaterThanOrEqual(4.5);
  const close = (await share(page).getByRole("button", { name: "Close Share job", exact: true }).boundingBox())!;
  expect(close.height).toBeGreaterThanOrEqual(44); expect(close.width).toBeGreaterThanOrEqual(44);
  if (theme === "system") { await page.emulateMedia({ colorScheme: "light" }); await expect(page.locator("html")).not.toHaveClass(/swx-dark/); await shot("share-system-light", share(page)); }
  expect(errors).toEqual([]);
});
