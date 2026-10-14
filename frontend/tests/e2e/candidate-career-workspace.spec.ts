import {test,expect} from "@playwright/test";
import {login,resetE2E,recordedRequests} from "./helpers";
import {mkdir} from "node:fs/promises";
test.beforeEach(async({request})=>resetE2E(request));
const shots="visual-artifacts/candidate-career-workspace";
test("Candidate navigation separates career, identity and Settings; collapsed state is server rendered",async({page,request})=>{
 await page.setViewportSize({width:1440,height:900});await login(page,"candidate");
 const sidebar=page.locator("#candidate-desktop-sidebar"),nav=page.getByRole("navigation",{name:"Candidate workspace",exact:true});
 await expect(nav.getByRole("link")).toHaveCount(7);await expect(nav.getByRole("heading")).toHaveText(["Career","Grow"]);
 await expect(sidebar.getByText(/\d+%/)).toHaveCount(0);await expect(nav.getByRole("link",{name:/Profile|Preferences|Interviews|Offers/})).toHaveCount(0);
 await expect.poll(async()=>Math.round((await sidebar.boundingBox())!.width)).toBe(256);
 const facts=page.locator(".candidate-readiness-facts");for(const icon of await facts.locator("dt svg").all()){expect((await icon.boundingBox())!.width).toBe(20);expect((await icon.boundingBox())!.height).toBe(20)}
 await expect(page.getByRole("banner").locator('img[alt="SapienWorx"]')).toBeHidden();
 await mkdir(shots,{recursive:true});await page.screenshot({path:shots+"/home-1440-expanded.png"});
 await page.getByRole("button",{name:"Collapse sidebar",exact:true}).press("Enter");
 await expect.poll(async()=>Math.round((await sidebar.boundingBox())!.width)).toBe(72);
 const response=await page.reload();expect(await response!.text()).toContain('data-sidebar-collapsed="true"');
 await page.screenshot({path:shots+"/home-1440-collapsed.png"});
 await nav.getByRole("link",{name:"Jobs",exact:true}).focus();await expect(page.getByRole("tooltip",{name:"Jobs",exact:true})).toBeVisible();
 await page.keyboard.press("Escape");await expect(page.getByRole("tooltip")).toHaveCount(0);
 await page.getByRole("button",{name:"Candidate profile menu",exact:true}).press("Enter");const account=page.getByRole("dialog",{name:"Your account",exact:true});
 await expect(account.getByRole("link")).toHaveText(["View profile","Edit profile","Resume","Profile completion","Help & support"]);
 await expect(account.getByText("Settings",{exact:true})).toHaveCount(0);await page.screenshot({path:shots+"/profile-menu-1440.png"});
 await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Candidate profile menu",exact:true})).toBeFocused();
 await page.getByRole("button",{name:"Settings",exact:true}).click();const settings=page.getByRole("navigation",{name:"Settings choices",exact:true});
 await expect(settings.getByRole("link")).toHaveText(["Job preferences","Notification preferences","Privacy & visibility","Account & security","Appearance","Data & consent"]);
 await page.screenshot({path:shots+"/settings-menu-1440.png"});await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Settings",exact:true})).toBeFocused();
 const before=(await recordedRequests(request)).filter(call=>call.path==="/api/v1/candidate/profile/details").length;
 await page.goto("/candidate/jobs");expect((await recordedRequests(request)).filter(call=>call.path==="/api/v1/candidate/profile/details").length).toBe(before); // Navigation itself uses Summary, not full profile data.
});
test("Candidate mobile navigation has exactly five destinations and avatar-only profile access",async({page})=>{
 await page.setViewportSize({width:360,height:800});await login(page,"candidate");
 const nav=page.getByRole("navigation",{name:"Candidate mobile navigation",exact:true});
 await expect(nav.getByRole("link")).toHaveText(["Home","Jobs","Applications",/Messages/,"Saved"]);
 await expect(page.locator("#candidate-desktop-sidebar")).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.getByRole("button",{name:"Candidate account",exact:true}).click();await expect(page.getByRole("dialog",{name:"Your account",exact:true})).toBeVisible();
 await page.screenshot({path:shots+"/profile-menu-360.png"});await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Candidate account",exact:true})).toBeFocused();
});
test("Overview readiness leads to incomplete sections and preview excludes private compensation/contact",async({page})=>{
 await login(page,"candidate");await page.getByRole("link",{name:/% complete. Open incomplete/}).click();
 await expect(page.locator("#profile-completion")).toHaveAttribute("open","");await expect(page.getByRole("heading",{name:"Next steps for your profile",exact:true})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"Candidate workspace",exact:true}).locator('[aria-current="page"]')).toHaveCount(0);
 await page.goto("/candidate/profile/preview");await expect(page.getByRole("heading",{name:"Professional profile preview",exact:true})).toBeVisible();
 await expect(page.locator("main").getByText("candidate@example.com",{exact:true})).toHaveCount(0);await expect(page.locator("main").getByText("Salary",{exact:true})).toHaveCount(0);
});
