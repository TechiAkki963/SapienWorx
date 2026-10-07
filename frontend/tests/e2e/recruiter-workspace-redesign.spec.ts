import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { login, resetE2E, waitForRecordedRequest } from "./helpers";
const root = "visual-artifacts/recruiter-workspace-redesign";
test.beforeEach(async ({ request }) => resetE2E(request));

test("Discover Talent seven viewports, appearances and mobile navigation", async ({ page }) => {
  test.setTimeout(240000); await login(page,"recruiter"); await fs.mkdir(root,{recursive:true});
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  for (const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]]) {
    await page.setViewportSize({width,height});
    for (const colorScheme of ["light","dark","no-preference"] as const) {
      await page.emulateMedia({colorScheme}); await page.goto("/recruiter/discover");
      await expect(page.getByRole("heading",{name:"Discover Talent",exact:true})).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
      await expect(page.locator(".swx-search-actions")).toBeInViewport();
      await page.screenshot({path:`${root}/discover-${width}-${colorScheme}.png`,fullPage:true,caret:"initial"});
      if (width < 1024) {
        await page.getByRole("button",{name:"More",exact:true}).click();
        const drawer=page.getByRole("dialog",{name:"More recruiter tools"}); await expect(drawer).toBeVisible();
        await expect(drawer.getByRole("link",{name:"Talent",exact:true})).toBeVisible();
        await page.keyboard.press("Shift+Tab"); expect(await drawer.evaluate(node=>node.contains(document.activeElement))).toBeTruthy();
        await page.keyboard.press("Escape"); await expect(drawer).not.toBeVisible(); await expect(page.getByRole("button",{name:"More",exact:true})).toBeFocused();
      }
    }
  }
  expect(errors).toEqual([]);
});

test("deep search decimals, skill chips, protected fields, preview and draft restoration",async ({page,request})=>{
  await login(page,"recruiter"); await page.goto("/recruiter/discover");
  await page.getByLabel("Minimum experience (years)",{exact:true}).fill("2.5");
  await page.getByLabel("Maximum experience (years)",{exact:true}).fill("8.75");
  await page.getByRole("combobox",{name:"Required skills",exact:true}).fill("Go, SQL, Leadership"); await page.keyboard.press("Enter");
  await page.getByText("Annual compensation",{exact:true}).click(); await expect(page.getByLabel("Minimum annual compensation",{exact:true})).toBeDisabled();
  await page.getByText("Inclusive hiring",{exact:true}).click(); await expect(page.getByLabel("Gender",{exact:true})).toBeDisabled();
  await page.locator(".swx-search-actions").getByRole("button",{name:"Search Talent",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Discover Talent Results",exact:true})).toBeVisible();
  const recorded=await waitForRecordedRequest(request,r=>r.method==="POST" && r.path==="/api/v1/recruiter/discover");
  expect(recorded.body.filters).toMatchObject({min_experience:"2.5",max_experience:"8.75",skills:"Go, SQL, Leadership"});
  expect(recorded.body.filters).not.toHaveProperty("gender"); expect(recorded.body.filters).not.toHaveProperty("min_salary");
  const candidate=page.getByRole("table",{name:"Discover Talent candidates"}).getByRole("button",{name:"Aarav Mehta",exact:true}); await candidate.click();
  const drawer=page.getByRole("dialog",{name:"Candidate preview"}); await expect(drawer).toBeVisible();
  await page.keyboard.press("Shift+Tab"); expect(await drawer.evaluate(node=>node.contains(document.activeElement))).toBeTruthy();
  await page.keyboard.press("Escape"); await expect(candidate).toBeFocused();
  await page.getByRole("button",{name:"Edit search",exact:true}).click(); await page.reload();
  await expect(page.getByLabel("Maximum experience (years)",{exact:true})).toHaveValue("8.75");
  await page.locator(".swx-search-actions").getByRole("button",{name:"Save search",exact:true}).click();
  const save=page.getByRole("dialog",{name:"Save search"}); await save.getByLabel("Search name").fill("Decimal professional search"); await save.getByLabel("Alert frequency").selectOption("weekly"); await save.getByRole("button",{name:"Save this search",exact:true}).click(); await expect(save).not.toBeVisible();
  await waitForRecordedRequest(request,r=>r.method==="PATCH" && r.path.includes("/saved-searches/") && r.body.frequency==="weekly");
});

test("invalid ranges and search failures retain criteria",async ({page})=>{
  await login(page,"recruiter"); await page.goto("/recruiter/discover");
  await page.getByLabel("Minimum experience (years)",{exact:true}).fill("9"); await page.getByLabel("Maximum experience (years)",{exact:true}).fill("3");
  await page.locator(".swx-search-actions").getByRole("button",{name:"Search Talent",exact:true}).click(); await expect(page.locator("#discovery-error-max_experience")).toContainText("Maximum experience"); await expect(page.getByLabel("Maximum experience (years)",{exact:true})).toBeFocused();
  await page.getByLabel("Maximum experience (years)",{exact:true}).fill("12");
  await page.route("**/api/v1/recruiter/discover",route=>route.request().method()==="POST"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{code:"unavailable",message:"Search temporarily unavailable"}})}):route.continue());
  await page.locator(".swx-search-actions").getByRole("button",{name:"Search Talent",exact:true}).click(); await expect(page.getByRole("heading",{name:"Search could not be completed"})).toBeVisible();
  await page.getByRole("button",{name:"Modify search",exact:true}).click(); await expect(page.getByLabel("Minimum experience (years)",{exact:true})).toHaveValue("9");
});
