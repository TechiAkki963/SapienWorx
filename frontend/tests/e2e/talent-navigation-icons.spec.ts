import {expect,test} from "@playwright/test";
import fs from "node:fs/promises";
import {login,resetE2E} from "./helpers";
const destinations=[["Overview","/recruiter/talent","overview"],["Discover","/recruiter/discover","discover"],["Pools","/recruiter/talent-pool","pools"],["Saved searches","/recruiter/saved-searches","saved"],["Outreach","/recruiter/outreach","outreach"],["Insights","/recruiter/talent/insights","insights"]] as const;
test.beforeEach(async({request})=>resetE2E(request));
test("Talent icons retain semantic identity and current-page navigation",async({page})=>{
 await login(page,"recruiter");await page.goto("/recruiter/talent");
 for(const[name,href,icon]of destinations){const nav=page.getByRole("navigation",{name:"Talent workspace",exact:true});const link=nav.getByRole("link",{name,exact:true});await expect(link.locator("svg")).toHaveAttribute("data-icon",icon);await expect(link).toHaveAttribute("href",href);await link.focus();await page.keyboard.press("Enter");await expect(page).toHaveURL(new RegExp(href+"$"));await expect(page.getByRole("navigation",{name:"Talent workspace",exact:true}).getByRole("link",{name,exact:true})).toHaveAttribute("aria-current","page");}
});
test("Talent navigation adapts to available width and stays legible across seven viewports and themes",async({page})=>{
 test.setTimeout(180000);await login(page,"recruiter");await fs.mkdir("visual-artifacts/talent-navigation",{recursive:true});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 for(const[width,height]of[[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800],[320,800]])for(const mode of["light","dark","system"]){await page.setViewportSize({width,height});await page.evaluate(mode=>localStorage.setItem("swx-theme",mode),mode);await page.goto("/recruiter/outreach");const nav=page.getByRole("navigation",{name:"Talent workspace",exact:true});await expect(nav).toBeVisible();
  const sizes=await nav.getByRole("link").evaluateAll(nodes=>nodes.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height,icon:n.querySelector("svg")?.getBoundingClientRect().width})));for(const size of sizes){expect(size.w).toBeGreaterThanOrEqual(44);expect(size.h).toBeGreaterThanOrEqual(44);expect(size.icon).toBe(20);}
  const current=nav.getByRole("link",{name:"Outreach",exact:true});const color=await current.evaluate(n=>({bg:getComputedStyle(n).backgroundColor,ink:getComputedStyle(n).color}));expect(color.bg).toBe("rgb(10, 102, 255)");expect(color.ink).toBe("rgb(255, 255, 255)");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();await page.screenshot({path:`visual-artifacts/talent-navigation/outreach-${width}-${mode}.png`,fullPage:true});
 }
 expect(errors).toEqual([]);
});
