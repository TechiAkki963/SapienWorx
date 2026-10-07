import {expect,test} from "@playwright/test";
import fs from "node:fs/promises";
import {login,MOCK_API,resetE2E} from "./helpers";
test.beforeEach(async ({request})=>resetE2E(request));

test("job builder and referral views cover all target widths and appearances",async ({page})=>{
  test.setTimeout(120000);await login(page,"recruiter");
  const root="visual-artifacts/recruiter-recruit-talent";await fs.mkdir(root,{recursive:true});
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]]){
    await page.setViewportSize({width,height});
    for(const colorScheme of ["light","dark","no-preference"] as const){
      await page.emulateMedia({colorScheme});
      for(const [name,route] of [["job-builder","/recruiter/jobs/new"],["referrals","/recruiter/referrals"]]){
        await page.goto(route);await expect(page.locator("main h1")).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
        await page.screenshot({path:`${root}/${name}-${width}-${colorScheme}.png`,fullPage:true,caret:"initial"});
      }
    }
  }
  expect(errors).toEqual([]);
});

test("outreach service failure stays distinct from an empty campaign list and can recover",async ({page,request})=>{
  await login(page,"recruiter");await request.post(`${MOCK_API}/__e2e/workspace`,{data:{fail:{outreach_get:true}}});
  await page.goto("/recruiter/outreach");await expect(page.getByRole("heading",{name:"Outreach is temporarily unavailable"})).toBeVisible();
  await expect(page.getByText("No campaigns",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Create campaign",exact:true})).toHaveCount(0);
  await request.post(`${MOCK_API}/__e2e/workspace`,{data:{fail:{outreach_get:false}}});
  await page.getByRole("link",{name:"Retry outreach",exact:true}).click();await expect(page.getByRole("button",{name:"Create campaign",exact:true})).toBeVisible();
});
