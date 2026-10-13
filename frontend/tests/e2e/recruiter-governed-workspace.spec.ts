import { expect,test } from "@playwright/test";
import {login,resetE2E,recordedRequests} from "./helpers";
test.beforeEach(async({request})=>resetE2E(request));
test("nav preference persists without duplicate selection, and job context retains Jobs",async({page})=>{
 await login(page,"recruiter");await page.goto("/recruiter/pipeline");
 const nav=page.locator("#recruiter-desktop-nav");
 await expect(nav.getByRole("navigation",{name:"Workspace",exact:true})).toBeVisible();
 await expect(nav.getByRole("link",{name:"Offers",exact:true})).toBeVisible();
 await expect(nav.getByText("Usage",{exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Collapse sidebar",exact:true}).click();
 await page.reload();await expect(page.getByRole("button",{name:"Expand sidebar",exact:true})).toBeVisible();
 expect(Math.round((await nav.boundingBox())!.width)).toBe(72);
 await page.goto("/recruiter/jobs/60000000-0000-4000-8000-000000000001/analytics");
 await expect(nav.getByRole("link",{name:"Jobs",exact:true})).toHaveAttribute("aria-current","page");
 await expect(page.getByRole("link",{name:"← Back to job overview",exact:true})).toHaveAttribute("href","/recruiter/jobs/60000000-0000-4000-8000-000000000001");
});
test("candidate cards expose notes, contain keyboard focus, and guard dirty dismissal",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/pipeline");
 await expect(page.getByRole("table",{name:"Hiring pipeline"})).toHaveCount(0);
 const cards=page.locator(".swx-candidate-card");await expect(cards).toHaveCount(10);
 await expect(cards.first().getByRole("button",{name:"CV unavailable",exact:true})).toBeDisabled();
 expect((await recordedRequests(request)).filter(r=>/\/cv$|\/comments$/.test(r.path))).toHaveLength(0);
 const trigger=cards.first().getByRole("button",{name:/^(Notes \d+|Add note)$/});await trigger.click();
 const modal=page.getByRole("dialog",{name:"Company notes",exact:true});await expect(modal).toBeVisible();
 const box=(await modal.boundingBox())!;expect(box.x).toBeGreaterThan(0);expect(Math.abs(box.x+box.width/2-page.viewportSize()!.width/2)).toBeLessThan(1);
 await modal.getByRole("textbox",{name:"Add an internal note"}).fill("Synthetic unsaved note");
 await page.keyboard.press("Escape");await expect(modal.getByRole("button",{name:"Keep editing"})).toBeVisible();
 await modal.getByRole("button",{name:"Keep editing"}).click();
 await page.keyboard.press("Shift+Tab");expect(await modal.evaluate(node=>node.contains(document.activeElement))).toBe(true);
 await page.keyboard.press("Escape");await modal.getByRole("button",{name:"Discard changes"}).click();
 await expect(modal).not.toBeVisible();await expect(trigger).toBeFocused();
});
test("jobs use the final operational columns, and all card widths stay within the viewport",async({page})=>{
 await login(page,"recruiter");await page.goto("/recruiter/jobs");
 const headers=page.getByRole("columnheader");await expect(headers).toContainText(["","Job title","Job ID","Status","Applications","Views","Posted","Actions"]);
 await expect(page.getByRole("columnheader",{name:"Deadline",exact:true})).toHaveCount(0);
 await expect(page.getByRole("columnheader",{name:"Health",exact:true})).toHaveCount(0);
 for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]]){
  await page.setViewportSize({width,height});await page.goto("/recruiter/pipeline");await expect(page.locator(".swx-candidate-card").first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`visual-artifacts/governed-workspace/applications-${width}-light.png`,fullPage:true,caret:"initial",animations:"disabled"});
 }
});

test("Talent overview loads plan usage only on explicit request",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/talent");
 await expect(page.getByRole("heading",{name:"Talent overview",exact:true})).toBeVisible();
 const before=await recordedRequests(request);
 expect(before.filter(item=>item.path==="/api/v1/recruiter/talent/usage")).toHaveLength(0);
 expect(before.filter(item=>item.path==="/api/v1/recruiter/discover")).toHaveLength(0);
 const trigger=page.getByRole("button",{name:"Plan & usage",exact:true});await trigger.click();
 const modal=page.getByRole("dialog",{name:"Talent plan & usage",exact:true});
 await expect(modal).toContainText("12 used / 100");await expect(modal).toContainText("48 used / 500");
 expect((await recordedRequests(request)).filter(item=>item.path==="/api/v1/recruiter/talent/usage")).toHaveLength(1);
 await page.keyboard.press("Escape");await expect(modal).not.toBeVisible();await expect(trigger).toBeFocused();
});

test("applicant message uses a centered keyboard dialog with guarded unsaved content",async({page})=>{
 await login(page,"recruiter");await page.goto("/recruiter/candidates/71000000-0000-4000-8000-000000000001");
 const trigger=page.getByRole("button",{name:"Message",exact:true});
 // The server-rendered trigger stays disabled until its client handler is ready.
 // focus()/press() do not wait for an enabled control as click() does.
 await expect(trigger).toBeEnabled();await trigger.focus();await expect(trigger).toBeFocused();await trigger.press("Enter");
 const modal=page.getByRole("dialog",{name:"Message candidate",exact:true});await expect(modal).toBeVisible();
 const box=(await modal.boundingBox())!;expect(Math.abs(box.x+box.width/2-page.viewportSize()!.width/2)).toBeLessThan(1);
 await expect(modal.getByRole("textbox",{name:"Subject",exact:true})).toBeFocused();
 await modal.getByRole("textbox",{name:"Subject",exact:true}).fill("Unsaved candidate follow-up");
 await page.keyboard.press("Escape");await expect(modal.getByRole("button",{name:"Keep editing",exact:true})).toBeVisible();
 await modal.getByRole("button",{name:"Keep editing",exact:true}).click();
 await modal.getByRole("button",{name:"Close Message candidate",exact:true}).focus();await page.keyboard.press("Shift+Tab");
 expect(await modal.evaluate(node=>node.contains(document.activeElement))).toBe(true);
 await page.keyboard.press("Escape");await modal.getByRole("button",{name:"Discard changes",exact:true}).click();
 await expect(modal).not.toBeVisible();await expect(trigger).toBeFocused();
});

test("Talent cards retain previous employment and education without repeating location",async({page})=>{
 await login(page,"recruiter");await page.goto("/recruiter/talent-pool");
 const card=page.locator(".swx-candidate-card").filter({has:page.getByRole("link",{name:"Aarav Mehta",exact:true})});
 await expect(card).toContainText("Previously Prior Partners");await expect(card).toContainText("B.E. Computer Engineering · QA University");await expect(card).toContainText("M.Sc. Data Systems · QA Institute");
 await expect(card).not.toContainText("Prefers Mumbai");await expect(page.getByRole("table",{name:"Saved candidates",exact:true})).toHaveCount(0);
});

test("bulk applicant message guards busy dismissal and duplicate sending",async({page})=>{
 let sends=0,finish:()=>void=()=>{};
 const pending=new Promise<void>(resolve=>{finish=resolve});
 await page.route("**/api/v1/recruiter/inmail/bulk",async route=>{sends++;await pending;await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({requested_count:1,recipient_count:1,sent_count:1,skipped_count:0,status:"sent"})})});
 await login(page,"recruiter");await page.goto("/recruiter/pipeline");
 await page.getByRole("checkbox",{name:"Select Candidate 001 for bulk actions",exact:true}).check();await page.getByRole("button",{name:"Message selected",exact:true}).click();
 const modal=page.getByRole("dialog",{name:"Message selected applicants",exact:true});await expect(modal).toBeVisible();
 await modal.getByLabel("Subject",{exact:true}).fill("Your application update");await modal.getByLabel("Message",{exact:true}).fill("We would like to discuss your application.");
 const send=modal.getByRole("button",{name:"Send to 1",exact:true});await send.click();
 await expect(modal).toHaveAttribute("aria-busy","true");await page.keyboard.press("Escape");await expect(modal).toBeVisible();
 await expect(modal.getByRole("button",{name:"Close Message selected applicants",exact:true})).toBeDisabled();
 await modal.getByRole("button",{name:"Sending…",exact:true}).evaluate(node=>{(node as HTMLButtonElement).click()});
 expect(sends).toBe(1);finish();await expect(modal).toContainText("Sent 1 message successfully.");
 await modal.getByRole("button",{name:"Cancel",exact:true}).click();await expect(modal).not.toBeVisible();await expect(page.getByRole("checkbox",{name:"Select all visible applicants",exact:true})).toBeFocused();
});

test("bulk message retry keeps its command key and sends edited template content",async({page})=>{
 const writes:{key:string|undefined;body:Record<string,unknown>}[]=[];
 await page.route("**/api/v1/recruiter/inmail/bulk",async route=>{
  writes.push({key:route.request().headers()["x-idempotency-key"],body:route.request().postDataJSON()});
  await route.fulfill({status:writes.length===1?503:200,contentType:"application/json",body:JSON.stringify(writes.length===1?{error:{code:"unavailable",message:"Synthetic connection interruption"}}:{requested_count:1,recipient_count:1,sent_count:1,skipped_count:0,status:"sent"})});
 });
 await login(page,"recruiter");await page.goto("/recruiter/pipeline");
 await page.getByRole("checkbox",{name:"Select Candidate 001 for bulk actions",exact:true}).check();await page.getByRole("button",{name:"Message selected",exact:true}).click();
 const modal=page.getByRole("dialog",{name:"Message selected applicants",exact:true});
 const templates=modal.getByLabel("Message template",{exact:true});await expect(templates).toBeEnabled();
 await templates.selectOption({index:1});await expect(modal.getByLabel("Subject",{exact:true})).not.toHaveValue("");
 await modal.getByLabel("Subject",{exact:true}).fill("An edited application update");await modal.getByLabel("Message",{exact:true}).fill("Custom content must replace the saved template.");
 await modal.getByRole("button",{name:"Send to 1",exact:true}).click();await expect(modal.getByRole("alert")).toContainText("Synthetic connection interruption");
 await modal.getByRole("button",{name:"Send to 1",exact:true}).click();await expect(modal).toContainText("Sent 1 message successfully.");
 expect(writes).toHaveLength(2);expect(writes[0].key).toBeTruthy();expect(writes[1].key).toBe(writes[0].key);
 expect(writes[0].body).toEqual(writes[1].body);expect(writes[0].body).not.toHaveProperty("template_id");
 expect(writes[0].body).toMatchObject({subject:"An edited application update",body:"Custom content must replace the saved template."});
});


test("job filters preserve operational selections and validate the posted-date range",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/jobs?status=active&q=Senior+Go");await page.getByRole("button",{name:"Filters",exact:true}).click();const modal=page.getByRole("dialog",{name:"Job filters",exact:true}),form=modal.getByRole("form",{name:"Additional job filters",exact:true});
 await form.getByLabel("Location",{exact:true}).fill("Mumbai");await form.getByLabel("Department",{exact:true}).fill("Engineering");await form.getByLabel("Posted by").selectOption("20000000-0000-4000-8000-000000000001");await form.getByLabel("Posted from",{exact:true}).fill("2026-10-01");await form.getByLabel("Posted through",{exact:true}).fill("2026-10-12");await form.getByRole("button",{name:"Apply job filters",exact:true}).click();
 await expect(page).toHaveURL(/location=Mumbai/);await expect(page).toHaveURL(/department=Engineering/);await expect(page).toHaveURL(/posted_by=20000000-0000-4000-8000-000000000001/);await expect(page).toHaveURL(/posted_from=2026-10-01/);await expect(page).toHaveURL(/posted_to=2026-10-12/);await expect(page).toHaveURL(/status=active/);await expect(page).toHaveURL(/q=Senior(?:\+|%20)Go/);
 await page.getByRole("form",{name:"Job filters",exact:true}).getByLabel("Sort",{exact:true}).selectOption("views");await expect(page).toHaveURL(/sort=views/);await expect(page).toHaveURL(/posted_from=2026-10-01/);
 const calls=await recordedRequests(request),last=calls.findLast(item=>item.path==="/api/v1/recruiter/jobs"&&item.method==="GET");expect(last?.search).toContain("posted_to=2026-10-12");expect(last?.search).toContain("department=Engineering");
 await page.getByRole("button",{name:"Filters (5)",exact:true}).click();await expect(form.getByLabel("Location",{exact:true})).toHaveValue("Mumbai");await form.getByLabel("Posted from",{exact:true}).fill("2026-10-13");await form.getByRole("button",{name:"Apply job filters",exact:true}).click();await expect(modal).toBeVisible();expect(await form.getByLabel("Posted from",{exact:true}).evaluate(node=>(node as HTMLInputElement).validity.rangeOverflow)).toBe(true);await expect(page).toHaveURL(/posted_from=2026-10-01/);
});
