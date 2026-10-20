import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { login, MOCK_API, resetE2E } from "./helpers";

const sizes = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]];
for (const [width,height] of sizes) for (const mode of ["light","dark","system"] as const) test(`AI operations ${width}x${height} ${mode}`,async({page,request})=>{
  await resetE2E(request);
  await request.post(MOCK_API+"/__e2e/admin-security",{data:{enabled:true,admin_role:"super_admin",assigned:true,mfa_enrolled:true,mfa_verified:true}});
  await page.setViewportSize({width,height});
  await page.addInitScript(mode=>localStorage.setItem("swx-theme",mode),mode);
  await page.emulateMedia({colorScheme:mode==="system"?"dark":"light"});
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await login(page,"master_admin");await page.goto("/swx-command-centre/intelligence");
  const region=page.getByRole("region",{name:"OpenAI operations"});
  await expect(region.getByText("disabled",{exact:true})).toBeVisible();
  for(const task of ["CV Parse","JD Parse","JD Generation"]) await expect(region.getByRole("heading",{name:new RegExp(task)})).toBeVisible();
  await expect(region.getByText("OFF / OFF",{exact:true})).toBeVisible();
  await expect(region.getByText("Daily spend / remaining",{exact:true})).toBeVisible();
  await expect(region.getByText("Monthly spend / remaining",{exact:true})).toBeVisible();
  await expect(region).not.toContainText(/sk-proj-|OPENAI_API_KEY|Authorization:|Bearer /);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
  await fs.mkdir("visual-artifacts/ai-beta-activation",{recursive:true});
  await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();document.documentElement.style.scrollBehavior="auto";window.scrollTo(0,0);});
  await page.screenshot({path:`visual-artifacts/ai-beta-activation/operations-${width}x${height}-${mode}.png`,fullPage:true,animations:"disabled"});
});
