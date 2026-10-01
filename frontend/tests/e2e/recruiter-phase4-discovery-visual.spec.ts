import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { login, resetE2E } from "./helpers";
const viewports=[{name:"laptop-1440",width:1440,height:900},{name:"desktop-1366",width:1366,height:768},{name:"tablet-1024",width:1024,height:768},{name:"tablet-768",width:768,height:1024},{name:"mobile-430",width:430,height:926},{name:"mobile-390",width:390,height:844},{name:"mobile-320",width:320,height:800}];
test.beforeEach(async({request})=>resetE2E(request));
test("Phase 4 recruiter candidate discovery is responsive and actionable",async({page})=>{
 test.setTimeout(180000);await login(page,"recruiter");await fs.mkdir("visual-artifacts/phase4-discovery",{recursive:true});
 for(const v of viewports){await page.setViewportSize({width:v.width,height:v.height});await page.goto("/recruiter/discover");
  await expect(page.getByRole("heading",{name:"Discover Talent"})).toBeVisible();await expect(page.getByText("Aarav Mehta")).toBeVisible();await expect(page.getByText("Meera Nair")).toBeVisible();if(v.width<1280){await expect(page.locator('label[for="discovery-filter-toggle"]')).toBeVisible();await page.locator('label[for="discovery-filter-toggle"]').click();await expect(page.getByText("Diversity sourcing")).toBeVisible();}else{await expect(page.getByText("Diversity sourcing")).toBeVisible();}await expect(page.getByText("Saved searches")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${v.name} horizontal overflow`).toBeTruthy();
  if(v.width<1280){await page.locator('label[for="discovery-filter-toggle"]').click();}await page.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll("nextjs-portal").forEach(x=>x.remove())});await page.screenshot({path:`visual-artifacts/phase4-discovery/discover-${v.name}.png`,fullPage:true});
 }
});
test("Phase 4 can save a search and add a discoverable candidate to Talent Pool",async({page})=>{
 await login(page,"recruiter");await page.goto("/recruiter/discover?industry=Logistics&location=Mumbai");
 const responsiveFilter=page.locator('label[for="discovery-filter-toggle"]');if(await responsiveFilter.isVisible())await responsiveFilter.click();
 await page.getByPlaceholder("e.g. Mumbai sales leaders").fill("Mumbai logistics leaders");const save=page.waitForRequest(r=>new URL(r.url()).pathname==="/api/v1/recruiter/saved-searches"&&r.method()==="POST");await page.getByRole("button",{name:"Save search"}).click();expect((await save).postDataJSON()).toMatchObject({name:"Mumbai logistics leaders"});
 const pool=page.waitForRequest(r=>/\/api\/v1\/recruiter\/talent-pool\/[^/]+$/.test(new URL(r.url()).pathname)&&r.method()==="PUT");await page.getByRole("button",{name:"Add to Talent Pool"}).first().click();expect((await pool).postDataJSON()).toEqual({tags:[]});await expect(page.getByText("Added to Talent Pool")).toBeVisible();
});

test("Discovery opens sourced Candidate 360 without exposing application-private data",async({page})=>{
 await login(page,"recruiter");await page.goto("/recruiter/discover");
 const meera=page.getByText("Meera Nair").locator("xpath=ancestor::article[1]");
 await meera.getByRole("link",{name:"View profile"}).click();
 await expect(page).toHaveURL(/\/recruiter\/candidates\/71000000-0000-4000-8000-000000000002\?from=discover/);
 await expect(page.getByText("Candidate 360°",{exact:true})).toBeVisible();
 await expect(page.getByRole("link",{name:"Back to discovery"})).toBeVisible();
 await expect(page.getByText("CV remains private until the candidate applies to your company.")).toBeVisible();
 await expect(page.getByText("private@example.test",{exact:true})).toHaveCount(0);
 await expect(page.locator('[aria-label^="Masked contact"]')).toHaveCount(0);
 await expect(page.getByRole("button",{name:/open (private )?cv/i})).toHaveCount(0);
 await expect(page.getByRole("button",{name:/view contact/i})).toHaveCount(0);
 await expect(page.getByText("Internal recruiter notes become available after the candidate applies to your company.")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"sourced Candidate 360 horizontal overflow").toBeTruthy();
});
