import {expect,test} from "@playwright/test";
import fs from "node:fs/promises";
import {login,resetE2E} from "./helpers";
const targets=[[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]];
const modes=[{mode:"light",scheme:"light"},{mode:"dark",scheme:"dark"},{mode:"system",scheme:"light"},{mode:"system",scheme:"dark"}] as const;
test("Governed offer screens fit every approved viewport and appearance",async({page,request})=>{
 test.setTimeout(600000);await resetE2E(request);await login(page,"recruiter");await fs.mkdir("visual-artifacts/governed-offers",{recursive:true});
 const issues:string[]=[];page.on("pageerror",e=>issues.push(e.message));page.on("console",m=>{if(m.type()==="error"&&/hydrat|does not match|server rendered/i.test(m.text()))issues.push(m.text())});
 for(const [width,height] of targets){await page.setViewportSize({width,height});for(const {mode,scheme} of modes){
  await page.emulateMedia({colorScheme:scheme});await page.evaluate(value=>localStorage.setItem("swx-theme",value),mode);
  for(const [slug,path,heading] of [["overview","/recruiter/offers","Offer Studio"],["detail","/recruiter/offers/93000000-0000-4000-8000-000000000001","Employment offer"],["composer","/recruiter/offers/new?application_id=70000000-0000-4000-8000-000000000002","Prepare an offer"],["template","/recruiter/offers/templates/new","Create company template"],["policy","/company/offer-governance","Offer governance"]]){
   await page.goto(path);await expect(page.getByRole("heading",{name:heading,exact:true}).first()).toBeVisible();await expect(page.locator("html")).toHaveAttribute("data-theme",mode);if(scheme==="dark")await expect(page.locator("html")).toHaveClass(/swx-dark/);else await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
   if(slug==="composer"){await page.getByRole("button",{name:"Continue",exact:true}).click();await page.getByRole("button",{name:"Continue",exact:true}).click();await expect(page.getByLabel("Joining date",{exact:true})).toBeVisible()}
   if((slug==="composer"||slug==="template")&&width<1024){
    await page.locator("main form footer").scrollIntoViewIfNeeded();const nav=await page.getByTestId("recruiter-bottom-nav").boundingBox();expect(nav).not.toBeNull();
    for(const button of await page.locator("main form footer button").all()){const box=await button.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(nav!.y);}
    await page.screenshot({path:`visual-artifacts/governed-offers/${slug}-actions-${width}-${mode}-${scheme}.png`,caret:"initial",animations:"disabled"});
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${slug} ${width} ${mode} ${scheme} overflow`).toBe(true);
   await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0)});
   await page.screenshot({path:`visual-artifacts/governed-offers/${slug}-${width}-${mode}-${scheme}.png`,fullPage:true,caret:"initial",animations:"disabled"});
  }
 }}
 expect(issues).toEqual([]);
});
test("Offer Studio follows live system appearance and its dirty cancel dialog contains focus",async({page,request})=>{
 await resetE2E(request);await login(page,"recruiter");await page.setViewportSize({width:360,height:800});await page.evaluate(()=>localStorage.setItem("swx-theme","system"));await page.emulateMedia({colorScheme:"light"});await page.goto("/recruiter/offers/templates/new");
 await expect(page.locator("html")).toHaveAttribute("data-theme","system");await expect(page.locator("html")).not.toHaveClass(/swx-dark/);await page.emulateMedia({colorScheme:"dark"});await expect(page.locator("html")).toHaveClass(/swx-dark/);await page.emulateMedia({colorScheme:"light"});await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
 await page.getByLabel("Template name",{exact:true}).fill("Unsaved synthetic template");await page.getByRole("button",{name:"Cancel",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Discard unsaved template changes?",exact:true});await expect(dialog).toBeVisible();await dialog.getByRole("button",{name:"Close Discard unsaved template changes?",exact:true}).focus();await page.keyboard.press("Shift+Tab");expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
 await dialog.getByRole("button",{name:"Keep editing",exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.getByRole("button",{name:"Cancel",exact:true})).toBeFocused();await expect(page.getByLabel("Template name",{exact:true})).toHaveValue("Unsaved synthetic template");
});
