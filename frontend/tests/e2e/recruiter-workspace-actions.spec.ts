import {expect,test} from "@playwright/test";
import fs from "node:fs/promises";
import {login,resetE2E,MOCK_API} from "./helpers";
test.beforeEach(async ({request})=>resetE2E(request));

test("drawers retain focus, full-width mobile layout and readable appearances",async ({page})=>{
  test.setTimeout(300000);await login(page,"recruiter");const root="visual-artifacts/recruiter-workspace-actions";await fs.mkdir(root,{recursive:true});
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]]){
    await page.setViewportSize({width,height});
    for(const colorScheme of ["light","dark"] as const){
      await page.emulateMedia({colorScheme});
      for(const [name,route,button,dialog] of [["schedule","/recruiter/interviews","Schedule interview","Schedule interview"],["offer","/recruiter/offers","Create offer","Create offer"],["pool-tags","/recruiter/talent-pool","Edit tags for Aarav Mehta","Edit pool tags"],["campaign","/recruiter/outreach","Create campaign","Create campaign"]]){
        await page.goto(route);const trigger=page.getByRole("button",{name:button,exact:true}).first();await trigger.click();
        const drawer=page.getByRole("dialog",{name:dialog,exact:true});await expect(drawer).toBeVisible();
        expect(await drawer.evaluate(node=>node.getBoundingClientRect().right<=innerWidth+1)).toBeTruthy();
        expect(await drawer.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBeTruthy();
        if(["schedule","offer","campaign"].includes(name)) {
          const footer=drawer.locator("footer"); await expect(footer).toBeVisible();
          expect(await footer.evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight+1)).toBeTruthy();
        }
        await page.screenshot({path:`${root}/${name}-${width}-${colorScheme}.png`,caret:"initial",animations:"disabled"});
        await drawer.getByRole("button",{name:`Close ${dialog}`,exact:true}).focus();await page.keyboard.press("Shift+Tab");expect(await drawer.evaluate(node=>node.contains(document.activeElement))).toBeTruthy();
        await page.keyboard.press("Escape");await expect(drawer).not.toBeVisible();await expect(trigger).toBeFocused();
      }
      await page.goto("/recruiter/discover");await page.locator(".swx-search-actions").getByRole("button",{name:"Search Talent",exact:true}).click();
      await page.getByRole("button",{name:"Aarav Mehta",exact:true}).click();await expect(page.getByRole("dialog",{name:"Candidate preview"})).toBeVisible();await page.screenshot({path:`${root}/preview-${width}-${colorScheme}.png`,caret:"initial",animations:"disabled"});await page.keyboard.press("Escape");
      await page.locator(".swx-search-actions").getByRole("button",{name:"Save search",exact:true}).click();await expect(page.getByRole("dialog",{name:"Save search",exact:true})).toBeVisible();await page.screenshot({path:`${root}/save-search-${width}-${colorScheme}.png`,caret:"initial",animations:"disabled"});await page.keyboard.press("Escape");
    }
  }
});

test("settled message contrast and live System appearance remain usable at all target widths",async ({page})=>{
  test.setTimeout(120000);await login(page,"recruiter");const root="visual-artifacts/recruiter-recruit-talent";
  await fs.mkdir(root,{recursive:true});
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]]){
    await page.setViewportSize({width,height});await page.goto("/recruiter/messages");
    if(width<768) await page.getByRole("button",{name:/Senior Go Platform Engineer opportunity/}).click();
    for(const colorScheme of ["light","dark","no-preference"] as const){
      await page.emulateMedia({colorScheme});
      await expect(page.locator("[data-message-id]").first()).toHaveCSS("opacity","1");
      if(colorScheme==="dark")await expect(page.locator("html")).toHaveClass(/swx-dark/);
      else await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
      const ratios=await page.locator(".swx-message-candidate,.swx-message-recruiter").evaluateAll(nodes=>{
        const luminance=(color:string)=>{const canvas=document.createElement("canvas");canvas.width=canvas.height=1;const context=canvas.getContext("2d")!;context.fillStyle=color;context.fillRect(0,0,1,1);const channels=Array.from(context.getImageData(0,0,1,1).data).slice(0,3).map(value=>{const n=value/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
        return nodes.map(node=>{const background=luminance(getComputedStyle(node).backgroundColor);const text=luminance(getComputedStyle(node.querySelector("p")!).color);return (Math.max(background,text)+.05)/(Math.min(background,text)+.05);});
      });
      for(const ratio of ratios)expect(ratio).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({path:`${root}/messages-${width}-${colorScheme}.png`,fullPage:true,caret:"initial",animations:"disabled"});
    }
  }
  await page.getByTitle("Appearance").click();await page.getByTitle("Light mode").click();await page.emulateMedia({colorScheme:"dark"});await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
  await page.getByTitle("Appearance").click();await page.getByTitle("Dark mode").click();await page.emulateMedia({colorScheme:"light"});await expect(page.locator("html")).toHaveClass(/swx-dark/);
});

test("analytics export contains aggregate metrics without candidate private fields",async ({page,request})=>{
  await request.post(`${MOCK_API}/__e2e/reset`);await login(page,"recruiter");await page.goto("/recruiter/analytics");
  const download=page.waitForEvent("download");await page.getByRole("button",{name:/Export.*CSV/i}).click();const file=await download;const stream=await file.createReadStream();let text="";for await(const chunk of stream!)text+=chunk.toString();
  expect(text).toContain("Source");expect(text).toContain("referral");expect(text).not.toContain("@example");expect(text).not.toContain("annual_compensation");
});
